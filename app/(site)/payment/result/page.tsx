"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type ResultStatus =
  | "pending"
  | "pending_verification"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "refunded";

interface PaymentResult {
  status: ResultStatus;
  amount: number;
  currency: string;
  provider: string;
  transactionReference: string;
}

export default function PaymentResultPage() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);

  useEffect(() => {
    if (!ref) {
      setError("Missing payment reference.");
      setLoading(false);

      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/payments/${encodeURIComponent(ref)}`);

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));

          if (!cancelled) {
            setError(
              body.error || `Could not load payment status (${res.status}).`,
            );
          }

          return;
        }
        const body = (await res.json()) as PaymentResult;

        if (!cancelled) setResult(body);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load payment status.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ref]);

  return (
    <div className="w-full min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-center">
        {loading && (
          <>
            <div className="mx-auto h-12 w-12 rounded-full border-b-2 border-red-800 animate-spin" />
            <p className="mt-4 text-gray-600">Loading payment status…</p>
          </>
        )}

        {!loading && error && (
          <>
            <div className="mx-auto h-12 w-12 rounded-full bg-red-100 text-red-800 flex items-center justify-center text-2xl">
              !
            </div>
            <h1 className="mt-4 text-xl font-bold text-gray-900">
              Could not load payment
            </h1>
            <p className="mt-2 text-gray-600">{error}</p>
            <Link
              className="mt-6 inline-block px-6 py-3 bg-red-800 text-white rounded-xl font-semibold hover:bg-red-900 transition-colors"
              href="/subscriptions"
            >
              Back to plans
            </Link>
          </>
        )}

        {!loading && !error && result && <ResultCard result={result} />}
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: PaymentResult }) {
  const formattedAmount = `${result.amount.toFixed(2)} ${result.currency}`;

  if (result.status === "succeeded") {
    return (
      <>
        <div className="mx-auto h-12 w-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-2xl">
          ✓
        </div>
        <h1 className="mt-4 text-xl font-bold text-gray-900">
          Payment successful
        </h1>
        <p className="mt-2 text-gray-600">
          We received {formattedAmount}. Your subscription is now active.
        </p>
        <Link
          className="mt-6 inline-block px-6 py-3 bg-red-800 text-white rounded-xl font-semibold hover:bg-red-900 transition-colors"
          href="/subscriptions"
        >
          View subscription
        </Link>
      </>
    );
  }

  if (result.status === "failed" || result.status === "cancelled") {
    return (
      <>
        <div className="mx-auto h-12 w-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-2xl">
          ✗
        </div>
        <h1 className="mt-4 text-xl font-bold text-gray-900">
          Payment {result.status === "cancelled" ? "cancelled" : "failed"}
        </h1>
        <p className="mt-2 text-gray-600">
          {result.status === "cancelled"
            ? "You cancelled the payment before it completed."
            : "The payment did not go through. You have not been charged."}
        </p>
        <Link
          className="mt-6 inline-block px-6 py-3 bg-red-800 text-white rounded-xl font-semibold hover:bg-red-900 transition-colors"
          href="/subscriptions"
        >
          Try again
        </Link>
      </>
    );
  }

  // pending or pending_verification
  return (
    <>
      <div className="mx-auto h-12 w-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-2xl">
        ⏳
      </div>
      <h1 className="mt-4 text-xl font-bold text-gray-900">
        Payment pending verification
      </h1>
      <p className="mt-2 text-gray-600">
        We received your {formattedAmount} payment but are still verifying it
        with the bank. We&apos;ll email you within 24 hours once it&apos;s
        confirmed.
      </p>
      <Link
        className="mt-6 inline-block px-6 py-3 bg-red-800 text-white rounded-xl font-semibold hover:bg-red-900 transition-colors"
        href="/subscriptions"
      >
        Back to plans
      </Link>
    </>
  );
}
