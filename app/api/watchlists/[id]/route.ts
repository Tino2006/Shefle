import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { query } from '@/lib/db/postgres';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;

    const result = await query(
      `
        DELETE FROM public.watchlists
        WHERE id = $1
          AND user_id = $2
      `,
      [id, user.id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete watchlist error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete monitor',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
