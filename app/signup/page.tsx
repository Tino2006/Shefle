import { Suspense } from "react";
import SignupForm from "./signup-form";

function SignupFallback() {
  return (
    <div className="w-full min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="text-sm text-gray-600">Loading…</div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupForm />
    </Suspense>
  );
}
