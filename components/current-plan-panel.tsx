"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type Plan = {
  id: string;
  name: string;
  price: number | string;
  currency: string;
  searches_limit: number | null;
  monitors_limit: number | null;
  notifications_limit: number | null;
};

type Subscription = {
  id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  plan: Plan;
};

type Usage = {
  searches_used: number;
  monitors_used: number;
  notifications_sent: number;
  searches_remaining: number | null;
  monitors_remaining: number | null;
  notifications_remaining: number | null;
};

type ApiResponse = {
  subscription: Subscription | null;
  usage: Usage | null;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const unlimited = limit === null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const barColor =
    pct >= 100
      ? "bg-red-700"
      : pct >= 80
        ? "bg-amber-500"
        : "bg-red-800";

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm tabular-nums text-gray-600">
          {unlimited ? (
            <span className="font-semibold text-green-700">Unlimited</span>
          ) : (
            <>
              <span className="font-semibold text-gray-900">{used}</span>
              <span className="text-gray-500"> / {limit}</span>
            </>
          )}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full ${unlimited ? "bg-green-500/30" : barColor} transition-all`}
          style={{ width: unlimited ? "100%" : `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function CurrentPlanPanel() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/subscriptions/current", {
        cache: "no-store",
      });

      if (res.status === 401) {
        setAuthed(false);
        setData(null);

        return;
      }

      setAuthed(true);

      if (!res.ok) {
        setData(null);

        return;
      }

      const body: ApiResponse = await res.json();

      setData(body);
    } catch (err) {
      console.error("[current-plan] load failed:", err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCancel = async () => {
    if (!data?.subscription) return;
    const confirmed = window.confirm(
      `Cancel your ${data.subscription.plan.name} plan? You'll keep access until ${formatDate(
        data.subscription.current_period_end,
      )}.`,
    );

    if (!confirmed) return;
    setCancelling(true);

    try {
      const res = await fetch(
        `/api/subscriptions/${data.subscription.id}/cancel`,
        {
          method: "POST",
        },
      );
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(body.error || "Could not cancel subscription.");

        return;
      }

      toast.success("Cancellation scheduled.");
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Network error cancelling.",
      );
    } finally {
      setCancelling(false);
    }
  };

  // Hide the whole panel for anonymous visitors — they just see the pricing grid.
  if (authed === false) return null;

  if (loading) {
    return (
      <div className="mx-auto mb-10 max-w-5xl rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-3 w-full animate-pulse rounded bg-gray-100" />
        <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  if (!data?.subscription || !data.usage) {
    return (
      <div className="mx-auto mb-10 max-w-5xl rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-600">
          You don't have an active subscription yet. Pick a plan below to get
          started.
        </p>
      </div>
    );
  }

  const { subscription, usage } = data;
  const { plan } = subscription;
  const cancelScheduled = subscription.cancel_at_period_end;

  return (
    <div className="mx-auto mb-10 max-w-5xl rounded-2xl border border-gray-100 bg-white p-6 shadow-sm lg:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-red-800">
            Your subscription
          </p>
          <h2 className="mt-1 text-2xl font-bold text-gray-900">
            {plan.name} plan
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {cancelScheduled ? (
              <>
                Cancels on{" "}
                <span className="font-medium text-gray-900">
                  {formatDate(subscription.current_period_end)}
                </span>
                . You keep access until then.
              </>
            ) : (
              <>
                Renews on{" "}
                <span className="font-medium text-gray-900">
                  {formatDate(subscription.current_period_end)}
                </span>
                .
              </>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {cancelScheduled ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
              Cancellation scheduled
            </span>
          ) : (
            <button
              className="rounded-full border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-800 transition-colors hover:bg-red-50 active:bg-red-100 disabled:opacity-60"
              disabled={cancelling}
              type="button"
              onClick={handleCancel}
            >
              {cancelling ? "Cancelling…" : "Cancel subscription"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
        <UsageBar
          label="Searches this period"
          limit={plan.searches_limit}
          used={usage.searches_used}
        />
        <UsageBar
          label="Active monitors"
          limit={plan.monitors_limit}
          used={usage.monitors_used}
        />
        <UsageBar
          label="Notifications sent"
          limit={plan.notifications_limit}
          used={usage.notifications_sent}
        />
      </div>
    </div>
  );
}
