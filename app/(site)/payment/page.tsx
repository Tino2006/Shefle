"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function PaymentPage() {
  const searchParams = useSearchParams();
  const price = searchParams.get("price") || "100";
  const billing = searchParams.get("billing") || "monthly";
  const yearlyTotal = searchParams.get("yearlyTotal");
  const [paymentMethod, setPaymentMethod] = useState("card");

  return (
    <div className="w-full min-h-screen bg-white flex flex-col">
      {/* Main Content */}
      <div className="flex-1 mx-auto max-w-[1400px] px-4 lg:px-20 py-12 lg:py-20">
        {/* Page Header */}
        <div className="text-center mb-12 lg:mb-16">
          <h1 className="text-3xl lg:text-4xl font-bold text-red-900 mb-3">
            Payment
          </h1>
          <p className="text-base lg:text-lg text-gray-600 max-w-2xl mx-auto">
            Manage your personal information, preferences, and account settings.
          </p>
        </div>

        {/* Payment Form */}
        <div className="max-w-md mx-auto bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          {/* Pay With Section */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Pay With:
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                checked={paymentMethod === "card"}
                className="form-radio text-red-800 h-4 w-4"
                name="paymentMethod"
                type="radio"
                value="card"
                onChange={() => setPaymentMethod("card")}
              />
              <span className="text-sm font-medium text-gray-700">Card</span>
            </label>
          </div>

          {/* Card Number */}
          <div className="mb-4">
            <label
              className="block text-sm font-medium text-gray-700 mb-2"
              htmlFor="cardNumber"
            >
              Card Number
            </label>
            <input
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-red-800 focus:border-red-800 text-sm"
              id="cardNumber"
              placeholder="Enter card number"
              type="text"
            />
          </div>

          {/* Expiration Date and CVV */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label
                className="block text-sm font-medium text-gray-700 mb-2"
                htmlFor="expirationDate"
              >
                Expiration Date
              </label>
              <input
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-red-800 focus:border-red-800 text-sm"
                id="expirationDate"
                placeholder="MM/YY"
                type="text"
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium text-gray-700 mb-2"
                htmlFor="cvv"
              >
                CVV
              </label>
              <input
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-red-800 focus:border-red-800 text-sm"
                id="cvv"
                placeholder="123"
                type="text"
              />
            </div>
          </div>

          {/* Pay Button */}
          <button className="w-full px-6 py-3 bg-red-800 text-white text-base font-semibold rounded-lg hover:bg-red-900 transition-colors mb-4">
            {billing === "yearly" && yearlyTotal
              ? `Pay US$${yearlyTotal}.00 / year`
              : `Pay US$${price}.00 / month`}
          </button>

          {/* Privacy Policy Text */}
          <p className="text-xs text-gray-500 text-center leading-relaxed">
            Your personal data will be used to process your order, support your
            experience through this website, and for other purposes described in
            our privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}
