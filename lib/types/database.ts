// Database types for TypeScript autocomplete

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  country: string | null;
  role: "user" | "admin";
  /** Uppercase alphanumeric; set at signup, immutable */
  referral_code?: string | null;
  /** Present when this account was referred; immutable after signup */
  referred_by_user_id?: string | null;
  notification_preferences: {
    email: boolean;
    sms: boolean;
  };
  created_at: string;
  updated_at: string;
};

export type ReferredUserSummary = {
  id: string;
  email: string | null;
  created_at: string;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  price: number;
  currency: string;
  searches_limit: number | null;
  monitors_limit: number | null;
  notifications_limit: number | null;
  stripe_price_id: string | null;
  is_active: boolean;
  created_at: string;
};

export type Subscription = {
  id: string;
  user_id: string;
  plan_id: string;
  status: "active" | "cancelled" | "expired" | "past_due";
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

export type Brand = {
  id: string;
  user_id: string;
  registration_type: "individual" | "company";
  name: string | null;
  company_name: string | null;
  email: string;
  phone: string;
  country: string;
  city: string;
  street_address: string | null;
  building_number: string | null;
  registration_country: string;
  type_of_work: string | null;
  poa_file_url: string;
  logo_file_url: string;
  business_license_url: string | null;
  passport_file_url: string | null;
  status: "pending" | "under_review" | "approved" | "rejected";
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TransactionStatus =
  | "pending"
  | "pending_verification"
  | "succeeded"
  | "failed"
  | "refunded"
  | "cancelled";

export type PaymentProvider = "stripe" | "areeba";

export type Transaction = {
  id: string;
  user_id: string;
  subscription_id: string | null;
  amount: number;
  currency: string;
  status: TransactionStatus;
  provider: PaymentProvider;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  payment_method_last4: string | null;
  receipt_url: string | null;
  /** Areeba-specific fields (NULL for Stripe rows) */
  transaction_reference: string | null;
  plan_id: string | null;
  billing_cycle: "monthly" | "yearly" | null;
  areeba_order_id: string | null;
  areeba_transaction_id: string | null;
  response_code: string | null;
  response_message: string | null;
  authorization_code: string | null;
  raw_request: Record<string, unknown> | null;
  raw_response: Record<string, unknown> | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string | null;
};

export type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  file_url: string | null;
  status: "new" | "read" | "replied" | "archived";
  created_at: string;
};

export type UsageTracking = {
  id: string;
  user_id: string;
  subscription_id: string | null;
  searches_used: number;
  monitors_used: number;
  notifications_sent: number;
  period_start: string;
  period_end: string | null;
  created_at: string;
};

export type PortfolioTrademarkApprovalStatus =
  | "pending"
  | "approved"
  | "rejected";

export type PortfolioTrademark = {
  id: string;
  user_id: string;
  registration_number: string;
  country: string;
  niche_class: number;
  niche_classes?: number[];
  registration_date: string;
  logo_url: string | null;
  logo_image_url: string | null;
  mark_name: string | null;
  approval_status: PortfolioTrademarkApprovalStatus;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Admin list row with submitter profile fields */
export type AdminPortfolioTrademarkRow = PortfolioTrademark & {
  owner_first_name: string | null;
  owner_last_name: string | null;
};
