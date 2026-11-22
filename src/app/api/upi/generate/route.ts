import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../../lib/supabase/client';
import { generateUpiLinkSchema } from '../../../../lib/validations/api';
import { generateUpiUri, formatInr } from '../../../../lib/upi';
import {
  checkRateLimit,
  getClientIdentifier,
  applyRateLimitHeaders,
} from '../../../../lib/rate-limit';

export async function POST(request: Request) {
  try {
    let userId: string | null = null;
    if (isSupabaseConfigured) {
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          userId = user.id;
        }
      } catch {
        // Fall back to IP rate limiting if auth session check fails
      }
    }

    const rateLimitId = getClientIdentifier('upi_gen', request, userId);
    const rateLimit = await checkRateLimit(rateLimitId, 60, 60000);

    const headers = new Headers();
    applyRateLimitHeaders(headers, rateLimit);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Please wait ${rateLimit.reset}s.` },
        { status: 429, headers }
      );
    }

    const rawBody = await request.json();
    const validation = generateUpiLinkSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid UPI Parameters',
          details: validation.error.issues.map((i) => i.message),
        },
        { status: 400, headers }
      );
    }

    const { payeeVpa, payeeName, amount, transactionNote, transactionRef } = validation.data;

    // Generate unique transaction reference if not provided
    const tr =
      transactionRef ||
      `TS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const upiUri = generateUpiUri({
      payeeVpa,
      payeeName,
      amount,
      transactionNote,
      transactionRef: tr,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          upiUri,
          payeeVpa,
          payeeName,
          amount,
          formattedAmount: formatInr(amount),
          currency: 'INR',
          transactionNote,
          transactionRef: tr,
          supportedApps: ['Google Pay', 'PhonePe', 'Paytm', 'BHIM', 'CRED UPI'],
        },
      },
      { headers }
    );
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
}