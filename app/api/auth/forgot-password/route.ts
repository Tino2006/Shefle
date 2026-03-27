import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const resetRequestSchema = z.object({
  email: z.string().email(),
});

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
      redirectTo: `${appUrl}/reset-password`,
    });

    if (error) {
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
