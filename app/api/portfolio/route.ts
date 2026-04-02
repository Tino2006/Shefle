import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { queryOne, queryRows } from '@/lib/db/postgres';
import { z } from 'zod';

const createPortfolioTrademarkSchema = z.object({
  registration_number: z.string().min(1, 'Registration number is required'),
  country: z.string().min(1, 'Country is required'),
  niche_class: z.number().int().min(1).max(45, 'Niche class must be between 1 and 45'),
  registration_date: z.string().min(1, 'Registration date is required'),
  logo_url: z.string().nullable().optional(),
  mark_name: z.string().nullable().optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const trademarks = await queryRows(
      `SELECT
        id::text,
        user_id::text,
        registration_number,
        country,
        niche_class,
        registration_date::text,
        logo_url,
        mark_name,
        created_at::text,
        updated_at::text
      FROM public.portfolio_trademarks
      WHERE user_id = $1
      ORDER BY created_at DESC`,
      [user.id]
    );

    return NextResponse.json({ success: true, trademarks });
  } catch (error) {
    console.error('List portfolio trademarks error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolio trademarks', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const validated = createPortfolioTrademarkSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validated.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const { registration_number, country, niche_class, registration_date, logo_url, mark_name } = validated.data;

    const result = await queryOne(
      `INSERT INTO public.portfolio_trademarks
        (user_id, registration_number, country, niche_class, registration_date, logo_url, mark_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id::text,
        user_id::text,
        registration_number,
        country,
        niche_class,
        registration_date::text,
        logo_url,
        mark_name,
        created_at::text,
        updated_at::text`,
      [user.id, registration_number, country, niche_class, registration_date, logo_url || null, mark_name || null]
    );

    if (!result) {
      throw new Error('Failed to create portfolio trademark');
    }

    return NextResponse.json({ success: true, trademark: result }, { status: 201 });
  } catch (error) {
    console.error('Create portfolio trademark error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isDuplicate = message.includes('idx_portfolio_trademarks_user_reg');
    return NextResponse.json(
      {
        error: isDuplicate ? 'You already have a trademark with this registration number' : 'Failed to create portfolio trademark',
        message,
      },
      { status: isDuplicate ? 409 : 500 }
    );
  }
}
