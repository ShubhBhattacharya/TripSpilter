import { NextResponse } from 'next/server';
import { generateUpiLinkSchema } from '../../../../lib/validations/api';
import { generateUpiUri, formatInr } from '../../../../lib/upi';
import { checkRateLimit, getClientIp } from '../../../../lib/rate-limit';

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(`upi_gen_${clientIp}`, 60, 60000);

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Please wait ${rateLimit.reset}s.` },
      { status: 429 }
    );
  }

  try {
    const rawBody = await request.json();
    const validation = generateUpiLinkSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid UPI Parameters',
          details: validation.error.issues.map((i) => i.message),
        },
        { status: 400 }
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

    return NextResponse.json({
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
    });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
}
