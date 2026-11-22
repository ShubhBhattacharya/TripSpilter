import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../lib/supabase/client';
import { ocrUploadSchema, ocrParsedReceiptSchema } from '../../../../lib/validations/api';
import {
  checkRateLimit,
  getClientIdentifier,
  applyRateLimitHeaders,
} from '../../../../lib/rate-limit';
import {
  requireAuthenticatedUser,
  UnauthorizedError,
} from '../../../../lib/security/auth-guards';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // 1. Authentication Check (Prevents anonymous quota draining & abuse)
    let userId: string | null = null;
    if (isSupabaseConfigured) {
      const supabase = await createClient();
      const user = await requireAuthenticatedUser(supabase);
      userId = user.id;
    }

    // 2. Strict Rate Limiting (5 OCR requests per minute per user/IP)
    const rateLimitId = getClientIdentifier('ocr_parse', req, userId);
    const rateLimit = await checkRateLimit(rateLimitId, 10, 60000);

    const headers = new Headers();
    applyRateLimitHeaders(headers, rateLimit);

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          configured: true,
          error: `Receipt scanning rate limit exceeded. Please wait ${rateLimit.reset}s.`,
        },
        { status: 429, headers }
      );
    }

    // 3. Payload & Image Size Validation
    const rawBody = await req.json();
    const validation = ocrUploadSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          configured: true,
          error: validation.error.issues[0]?.message || 'Invalid image upload payload',
        },
        { status: 400, headers }
      );
    }

    const { image: imageBase64 } = validation.data;

    // 4. API Key Check
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

    if (!geminiKey) {
      return NextResponse.json(
        {
          configured: false,
          error:
            'AI OCR Vision requires GEMINI_API_KEY configured in server environment. Please enter line items manually.',
        },
        { status: 200, headers }
      );
    }

    // Extract clean base64 data and MIME type
    const matches = imageBase64.match(/^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/);
    const mimeType = matches ? matches[1] : 'image/jpeg';
    const cleanBase64 = matches ? matches[3] : imageBase64;

    const prompt = `Analyze this Indian restaurant/hotel receipt or bill.
Extract the following information as strict JSON:
{
  "merchantName": "Name of the restaurant/vendor",
  "date": "Date of bill if visible",
  "invoiceNumber": "Invoice or Bill Number if visible",
  "items": [
    { "name": "Item Name", "price": 0.00 }
  ],
  "subtotal": 0.00,
  "gstAmount": 0.00,
  "serviceCharge": 0.00,
  "totalAmount": 0.00
}
Return ONLY valid JSON with no markdown backticks or commentary.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: cleanBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            response_mime_type: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(15000), // 15-second timeout protection
      }
    );

    if (!response.ok) {
      // Avoid exposing provider secrets, keys or internal API details
      return NextResponse.json(
        {
          configured: true,
          error: 'Vision AI OCR service was temporarily unable to parse this receipt. Please verify image clarity or enter items manually.',
        },
        { status: 502, headers }
      );
    }

    const resData = await response.json();
    const textOutput = resData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textOutput) {
      return NextResponse.json(
        {
          configured: true,
          error: 'No text or line items could be detected on the uploaded receipt.',
        },
        { status: 422, headers }
      );
    }

    // 5. Validate AI-generated JSON before returning
    try {
      const parsedRaw = JSON.parse(textOutput);
      const validatedData = ocrParsedReceiptSchema.parse(parsedRaw);

      return NextResponse.json(
        {
          configured: true,
          ...validatedData,
          isAiExtracted: true,
          isVerified: false,
          requiresUserConfirmation: true,
        },
        { headers }
      );
    } catch {
      return NextResponse.json(
        {
          configured: true,
          error: 'Unable to parse structural receipt data from AI output. Please enter line items manually.',
        },
        { status: 422, headers }
      );
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json(
      {
        configured: true,
        error: 'An internal error occurred while processing receipt image.',
      },
      { status: 500 }
    );
  }
}