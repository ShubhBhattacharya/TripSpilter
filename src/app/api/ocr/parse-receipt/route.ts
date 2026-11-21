import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface ParsedReceiptItem {
  name: string;
  price: number;
}

interface ParsedReceiptResponse {
  configured: boolean;
  merchantName?: string;
  date?: string;
  invoiceNumber?: string;
  items?: ParsedReceiptItem[];
  subtotal?: number;
  gstAmount?: number;
  serviceCharge?: number;
  totalAmount?: number;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENAI_API_KEY ||
      process.env.OPENAI_API_KEY;

    // Check if an AI Vision API key is configured
    if (!apiKey) {
      return NextResponse.json<ParsedReceiptResponse>(
        {
          configured: false,
          error:
            'AI OCR Vision requires GEMINI_API_KEY or OPENAI_API_KEY in your environment (.env.local). Please enter line items manually.',
        },
        { status: 200 }
      );
    }

    // Read payload
    const body = await req.json();
    const imageBase64 = body.image; // Base64 data URI

    if (!imageBase64) {
      return NextResponse.json(
        { configured: true, error: 'No image data provided' },
        { status: 400 }
      );
    }

    // Call Gemini multimodal API if GEMINI_API_KEY is available
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY) {
      const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

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
                      mime_type: 'image/jpeg',
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
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        return NextResponse.json({
          configured: true,
          error: `Vision API error: ${response.status} - ${errText.slice(0, 150)}`,
        });
      }

      const resData = await response.json();
      const textOutput = resData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textOutput) {
        const parsed = JSON.parse(textOutput);
        return NextResponse.json<ParsedReceiptResponse>({
          configured: true,
          ...parsed,
        });
      }
    }

    return NextResponse.json<ParsedReceiptResponse>({
      configured: false,
      error: 'Vision processing could not parse the receipt image.',
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json<ParsedReceiptResponse>(
      {
        configured: true,
        error: error.message || 'Internal server error processing receipt.',
      },
      { status: 500 }
    );
  }
}
