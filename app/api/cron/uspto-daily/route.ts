import { NextRequest, NextResponse } from 'next/server';
import { runUSPTODailyImport } from '@/lib/uspto/runDailyImport';

export const runtime = 'nodejs';
export const maxDuration = 300;

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }

  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runUSPTODailyImport();
    return NextResponse.json({
      ok: true,
      source: 'vercel-cron',
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected cron error';
    console.error('[USPTO Cron] Failed:', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'USPTO daily import failed',
        message,
      },
      { status: 500 }
    );
  }
}
