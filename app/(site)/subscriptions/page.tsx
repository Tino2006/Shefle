"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import { CurrentPlanPanel } from "@/components/current-plan-panel";

interface MpgsCheckout {
  configure: (opts: { session: { id: string } }) => void;
  showPaymentPage: () => void;
}

declare global {
  interface Window {
    Checkout?: MpgsCheckout;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

const plans = [
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
];

export default function SubscriptionsPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);

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
        <CurrentPlanPanel />

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto pt-6 pb-10">
          {displayedPlans.map((plan, index) => (
            <div
              key={index}
              className={`group relative bg-white rounded-2xl p-8 flex flex-col border-2 transform-gpu will-change-transform transition-[transform,box-shadow,border-color] duration-300 ease-out cursor-pointer hover:-translate-y-2 hover:scale-[1.04] hover:shadow-2xl hover:border-red-800 hover:z-10 ${
                plan.highlighted
                  ? "border-red-800 shadow-xl scale-[1.02]"
                  : "border-gray-200 shadow-sm"
              }`}
            >
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
                {plan.name}
              </p>
              {/* Price */}
              <div className="mb-8">
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

              {/* Buy Button */}
              <button
                className={`w-full px-6 py-3 text-base font-semibold rounded-lg transition-colors text-center block disabled:opacity-60 disabled:cursor-not-allowed ${
                  plan.highlighted
                    ? "bg-red-800 text-white hover:bg-red-900"
                    : "bg-gray-200 text-gray-900 hover:bg-gray-300"
                }`}
                disabled={pendingPlan !== null}
                type="button"
                onClick={() => handleSubscribe(plan.name)}
              >
                {pendingPlan === plan.name ? "Redirecting…" : "Buy"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
