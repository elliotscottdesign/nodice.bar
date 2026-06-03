"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";

// Publishable key — safe to ship in the browser. Stripe designed it that way.
// Override via NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY at build time if we ever
// want to switch back to test mode (the secret/webhook side is governed by
// Supabase Edge Function secrets — these two halves must match).
const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
  "pk_live_51TVsTZEpRnfAMZgtrvncT1YGkRAg4pGvgyutMpWrlcNdcyJFUL7PhbN9wUb0wzBrx3652OBS5rPRNoBfgpkhbtjk00MZFqkfax";

let _stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!_stripePromise) {
    _stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return _stripePromise;
}

// Supabase project URL — Edge Function endpoints hang off this.
// Mirrors lib/supabase.ts so the two helpers can't drift.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://bieikfwhzkdekojerdqs.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpZWlrZndoemtkZWtvamVyZHFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTYxNDQsImV4cCI6MjA5NDA5MjE0NH0.QYdO8mwThnhiK19x_SlxKu15W4yKxMS5Oooxh3rI2zI";

export const CREATE_PAYMENT_INTENT_URL =
  `${SUPABASE_URL}/functions/v1/create-payment-intent`;

export const GET_BOOKING_URL =
  `${SUPABASE_URL}/functions/v1/get-booking`;
