import { NextResponse } from 'next/server';
import { getServerIntegrationStatus } from '../../../../lib/config/env';

export async function GET() {
  return NextResponse.json({
    status: getServerIntegrationStatus(),
    timestamp: new Date().toISOString(),
  });
}
