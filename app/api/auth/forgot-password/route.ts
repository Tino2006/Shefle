import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const resetRequestSchema = z.object({
  email: z.string().email(),
});

function parseRetryAfterSeconds(message: string): number | null {
  const match = message.match(/after\s+(\d+)\s+seconds?/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = resetRequestSchema.parse(body);

    const supabase = await createClient();
    const requestOrigin = new URL(request.url).origin;
    const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    const appUrl =
      configuredAppUrl && !configuredAppUrl.includes('localhost')
        ? configuredAppUrl
        : requestOrigin;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Recovery links can include hash tokens that server routes cannot read.
      // Send users directly to the reset page so the browser client can finalize session recovery.
      redirectTo: `${appUrl}/reset-password`,
    });

    if (error) {
      const isRateLimitError =
        error.status === 429 || /rate limit exceeded/i.test(error.message);
      if (isRateLimitError) {
        return NextResponse.json(
          {
            error: 'Too many reset requests. Please wait before trying again.',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfterSeconds: parseRetryAfterSeconds(error.message),
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Password reset email sent. Please check your inbox.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
