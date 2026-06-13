"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

import { CurrentPlanPanel } from "@/components/current-plan-panel";

interface MpgsCheckout {
  configure: (opts: { session: { id: string } }) => void;
  showPaymentPage: () => void;
}

declare global {
  interface Window {
    Checkout?: MpgsCheckout;

    errorCallback?: (err: any) => void;
  }
}

/**
 * Load the MPGS Checkout JS SDK once, then resolve when window.Checkout is
 * ready. Cached across calls so re-clicks don't re-inject the script.
 */
function loadCheckoutScript(src: string): Promise<MpgsCheckout> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Cannot load checkout on server"));
  }
  if (window.Checkout) return Promise.resolve(window.Checkout);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-areeba-checkout="1"]`,
    );

    if (existing) {
      existing.addEventListener("load", () => {
        if (window.Checkout) resolve(window.Checkout);
        else reject(new Error("Checkout SDK loaded but global missing"));
      });
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Areeba checkout SDK")),
      );

      return;
    }

    // The MPGS SDK requires data-error and data-cancel attrs at script-tag time.
    // data-cancel is where the user lands if they back out of the hosted page.
    const script = document.createElement("script");

    script.src = src;
    script.async = true;
    script.dataset.areebaCheckout = "1";
    script.setAttribute("data-error", "errorCallback");
    script.setAttribute(
      "data-cancel",
      `${window.location.origin}/subscriptions`,
    );
    window.errorCallback = (err) => {
      console.error("[areeba] checkout SDK error", err);
      toast.error("Payment could not be opened. Please try again.");
    };
    script.onload = () => {
      if (window.Checkout) resolve(window.Checkout);
      else reject(new Error("Checkout SDK loaded but global missing"));
    };
    script.onerror = () =>
      reject(new Error("Failed to load Areeba checkout SDK"));
    document.head.appendChild(script);
  });
}

type Plan = {
  name: string;
  monthlyPrice?: number;
  features: string[];
  highlighted: boolean;
  custom?: boolean;
};

const plans: Plan[] = [
  {
    name: "Starter",
    monthlyPrice: 100,
    features: ["50 Searches available", "1 Monitor", "20 Notifications"],
    highlighted: false,
  },
  {
    name: "Growth",
    monthlyPrice: 150,
    features: ["70 Searches available", "2 Monitor", "40 Notifications"],
    highlighted: true,
  },
  {
    name: "Enterprise",
    monthlyPrice: 200,
    features: [
      "Unlimited Searches Available",
      "3 Monitor",
      "Unlimited Notifications",
      "5% Discount on registration",
    ],
    highlighted: false,
  },
  {
    name: "Custom",
    custom: true,
    features: [
      "Tailored search & monitor limits",
      "Dedicated support",
      "Custom integrations",
      "Volume pricing",
    ],
    highlighted: false,
  },
];

type CurrentSubscription = {
  subscriptionId: string;
  planName: string;
  planPrice: number;
};

export default function SubscriptionsPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [current, setCurrent] = useState<CurrentSubscription | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // Bumped after a cancel/upgrade to remount <CurrentPlanPanel /> so it refetches.
  const [panelKey, setPanelKey] = useState(0);

  const loadCurrent = useCallback(async () => {
    try {
      const res = await fetch("/api/subscriptions/current", {
        cache: "no-store",
      });

      if (!res.ok) {
        setCurrent(null);

        return;
      }

      const body = await res.json();

      if (body?.subscription?.plan) {
        setCurrent({
          subscriptionId: body.subscription.id,
          planName: body.subscription.plan.name,
          planPrice: Number(body.subscription.plan.price),
        });
      } else {
        setCurrent(null);
      }
    } catch (err) {
      console.error("[subscriptions] load current failed:", err);
      setCurrent(null);
    }
  }, []);

  useEffect(() => {
    void loadCurrent();
  }, [loadCurrent]);

  const handleCancel = async () => {
    if (!current || cancelling) return;
    const confirmed = window.confirm(
      `Cancel your ${current.planName} plan? You'll keep access until the end of your current billing period.`,
    );

    if (!confirmed) return;
    setCancelling(true);

    try {
      const res = await fetch(
        `/api/subscriptions/${current.subscriptionId}/cancel`,
        { method: "POST" },
      );
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(body.error || "Could not cancel subscription.");

        return;
      }

      toast.success("Cancellation scheduled.");
      await loadCurrent();
      setPanelKey((k) => k + 1);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Network error cancelling.",
      );
    } finally {
      setCancelling(false);
    }
  };

  const handleSubscribe = async (planName: string) => {
    if (pendingPlan) return;
    setPendingPlan(planName);
    let redirecting = false;

    try {
      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planSlug: planName.toLowerCase(),
          billingCycle,
        }),
      });
      const body = await res.json().catch(() => ({}));

      if (res.status === 401) {
        toast.error("Please sign in to continue.");
        redirecting = true;
        window.location.href = `/login?redirect=${encodeURIComponent("/subscriptions")}`;

        return;
      }
      if (res.status === 501) {
        toast.error(
          body.error ||
            "Payment provider not configured yet. Please try again later.",
        );

        return;
      }
      if (!res.ok) {
        toast.error(body.error || "Could not start payment. Please try again.");

        return;
      }
      if (!body.sessionId || !body.checkoutScriptUrl) {
        toast.error("Payment session missing from response.");

        return;
      }

      const Checkout = await loadCheckoutScript(body.checkoutScriptUrl);

      Checkout.configure({ session: { id: body.sessionId } });
      redirecting = true;
      // Hands off to Areeba's hosted form (whole-page navigation). User returns
      // to AREEBA_RETURN_URL (?ref=<uuid>) — see /payment/result.
      Checkout.showPaymentPage();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Network error starting payment.",
      );
    } finally {
      if (!redirecting) setPendingPlan(null);
    }
  };

  const displayedPlans = useMemo(() => {
    return plans.map((plan) => {
      if (plan.custom || plan.monthlyPrice == null) {
        return { ...plan, displayPrice: null, yearlyTotal: null };
      }

      const yearlyMonthlyEquivalent = Math.round(plan.monthlyPrice * 0.7);
      const yearlyTotal = yearlyMonthlyEquivalent * 12;
      const displayPrice =
        billingCycle === "monthly"
          ? plan.monthlyPrice
          : yearlyMonthlyEquivalent;

      return {
        ...plan,
        displayPrice,
        yearlyTotal,
      };
    });
  }, [billingCycle]);

  return (
    <div className="w-full min-h-screen bg-white flex flex-col">
      {/* Main Content */}
      <div className="flex-1 mx-auto max-w-[1400px] px-4 lg:px-20 py-12 lg:py-20">
        {/* Page Header */}
        <div className="text-center mb-12 lg:mb-16">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
            Subscriptions
          </h1>
          <p className="text-base lg:text-lg text-gray-600 max-w-2xl mx-auto">
            Manage your personal information, preferences, and account settings.
          </p>
        </div>

        {/* Current-plan panel (rendered only for logged-in users) */}
        <CurrentPlanPanel key={panelKey} />

        {/* Billing Toggle */}
        <div className="mb-10 flex flex-col items-center gap-3">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
            <button
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                billingCycle === "monthly"
                  ? "bg-red-800 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
              type="button"
              onClick={() => setBillingCycle("monthly")}
            >
              Monthly
            </button>
            <button
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                billingCycle === "yearly"
                  ? "bg-red-800 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
              type="button"
              onClick={() => setBillingCycle("yearly")}
            >
              Yearly
            </button>
          </div>
          <p className="text-sm text-red-800 font-medium">
            Yearly billing includes 30% discount
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto pt-6 pb-10">
          {displayedPlans.map((plan, index) => {
            // Highlight follows the cursor: a card is active when it's hovered,
            // or — when nothing is hovered — when it's the default featured plan.
            const isActive =
              hoveredIndex === index ||
              (hoveredIndex === null && plan.highlighted);

            const planPrice = plan.monthlyPrice ?? 0;
            const isCurrent =
              current != null &&
              !plan.custom &&
              current.planName.toLowerCase() === plan.name.toLowerCase();
            const isUpgrade =
              current != null && !plan.custom && planPrice > current.planPrice;
            const isLower =
              current != null && !plan.custom && planPrice < current.planPrice;

            return (
              <div
                key={index}
                className={`group relative bg-white rounded-2xl p-8 flex flex-col border-2 transform-gpu will-change-transform transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-2 hover:scale-[1.04] hover:shadow-2xl hover:border-red-800 hover:z-10 ${
                  isActive
                    ? "border-red-800 shadow-xl scale-[1.02]"
                    : "border-gray-200 shadow-sm"
                }`}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  {plan.name}
                </p>
                {/* Price */}
                <div className="mb-8">
                  {plan.custom ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-gray-900">
                        Let&apos;s talk
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-bold text-gray-900">
                          ${plan.displayPrice}
                        </span>
                        <span className="text-xl text-gray-500">/mo</span>
                      </div>
                      {billingCycle === "yearly" && (
                        <p className="mt-2 text-sm text-gray-600">
                          Billed yearly at ${plan.yearlyTotal}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Features List */}
                <div className="space-y-4 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-800 flex items-center justify-center mt-0.5">
                        <svg
                          className="w-3 h-3 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            clipRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            fillRule="evenodd"
                          />
                        </svg>
                      </div>
                      <span className="text-[15px] text-gray-900 leading-relaxed">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                {plan.custom ? (
                  <Link
                    className="w-full px-6 py-3 text-base font-semibold rounded-lg transition-colors text-center block bg-red-800 text-white hover:bg-red-900"
                    href="/contact"
                  >
                    Contact us
                  </Link>
                ) : isCurrent ? (
                  <button
                    className="w-full px-6 py-3 text-base font-semibold rounded-lg transition-colors text-center block border-2 border-red-800 text-red-800 bg-white hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={cancelling}
                    type="button"
                    onClick={handleCancel}
                  >
                    {cancelling ? "Cancelling…" : "Cancel"}
                  </button>
                ) : isLower ? (
                  <button
                    disabled
                    className="w-full px-6 py-3 text-base font-semibold rounded-lg text-center block bg-gray-100 text-gray-400 cursor-not-allowed"
                    type="button"
                  >
                    Current plan or lower
                  </button>
                ) : (
                  <button
                    className={`w-full px-6 py-3 text-base font-semibold rounded-lg transition-colors text-center block disabled:opacity-60 disabled:cursor-not-allowed ${
                      isActive
                        ? "bg-red-800 text-white hover:bg-red-900"
                        : "bg-gray-200 text-gray-900 hover:bg-gray-300"
                    }`}
                    disabled={pendingPlan !== null}
                    type="button"
                    onClick={() => handleSubscribe(plan.name)}
                  >
                    {pendingPlan === plan.name
                      ? "Redirecting…"
                      : isUpgrade
                        ? "Upgrade"
                        : "Buy"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
