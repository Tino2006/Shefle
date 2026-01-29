// Database types for TypeScript autocomplete

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  country: string | null;
  role: 'user' | 'admin';
  notification_preferences: {
    email: boolean;
    sms: boolean;
  };
  created_at: string;
  updated_at: string;
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
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
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
  registration_type: 'individual' | 'company';
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
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  subscription_id: string | null;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  payment_method_last4: string | null;
  receipt_url: string | null;
  created_at: string;
};

export type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  file_url: string | null;
  status: 'new' | 'read' | 'replied' | 'archived';
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
