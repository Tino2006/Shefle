import { createClient } from '@/lib/supabase/server';
import { verifyAdminApi, isErrorResponse } from '@/lib/api-middleware';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Verify admin access
    const authResult = await verifyAdminApi();
    if (isErrorResponse(authResult)) {
      return authResult;
    }

    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    const { data: brands, error } = await supabase
      .from('brands')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ brands });
  } catch (error) {
    console.error('Admin brands error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
