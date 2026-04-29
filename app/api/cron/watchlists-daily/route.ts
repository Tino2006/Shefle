import { NextRequest, NextResponse } from "next/server";

import { queryOne, queryRows } from "@/lib/db/postgres";
import { runWatchlistCheck } from "@/lib/watchlists/runWatchlistCheck";
import { sendMonitorAlertEmail } from "@/lib/notifications/sendMonitorAlertEmail";

export const runtime = "nodejs";
export const maxDuration = 300;

interface WatchlistRow {
  id: string;
  user_id: string;
  query: string;
}

interface UserEmailRow {
  email: string | null;
  first_name: string | null;
  email_enabled: boolean;
}

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) return false;

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const watchlists = await queryRows<WatchlistRow>(
      `
        SELECT id::text, user_id::text, query
        FROM public.watchlists
        ORDER BY created_at ASC
      `,
    );

    const byUser = new Map<
      string,
      Array<{
        watchlistQuery: string;
        newTextHits: number;
        newVisualHits: number;
        checkedAt: string;
      }>
    >();

    let checked = 0;

    for (const watchlist of watchlists) {
      const result = await runWatchlistCheck(watchlist.id);

      checked++;

      if (result.new_hits > 0 || result.new_visual_hits > 0) {
        const existing = byUser.get(watchlist.user_id) || [];

        existing.push({
          watchlistQuery: watchlist.query,
          newTextHits: result.new_hits,
          newVisualHits: result.new_visual_hits,
          checkedAt: result.checked_at,
        });
        byUser.set(watchlist.user_id, existing);
      }
    }

    let emailsSent = 0;
    const fallbackEmail = process.env.MONITOR_ALERT_TO_EMAIL;

    for (const [userId, items] of Array.from(byUser.entries())) {
      const user = await queryOne<UserEmailRow>(
        `
          SELECT
            u.email,
            p.first_name,
            COALESCE((p.notification_preferences->>'email')::boolean, true) AS email_enabled
          FROM auth.users u
          LEFT JOIN public.profiles p ON p.id = u.id
          WHERE u.id = $1::uuid
          LIMIT 1
        `,
        [userId],
      );

      const recipient = user?.email || fallbackEmail || null;
      const emailEnabled = user?.email_enabled ?? true;

      if (!recipient || !emailEnabled) continue;

      await sendMonitorAlertEmail({
        to: recipient,
        firstName: user?.first_name,
        items,
      });
      emailsSent++;
    }

    return NextResponse.json({
      ok: true,
      source: "vercel-cron",
      checked_watchlists: checked,
      users_with_new_matches: byUser.size,
      emails_sent: emailsSent,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected cron error";

    console.error("[Watchlists Cron] Failed:", error);

    return NextResponse.json(
      { ok: false, error: "Daily watchlist cron failed", message },
      { status: 500 },
    );
  }
}
