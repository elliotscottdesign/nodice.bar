"use client";

// =============================================================
// promoter — client helper for the promoter portal
// =============================================================
// Talks to the `promoter` edge function (service role, --no-verify-jwt). The
// portal (/promoter) uses the public actions with a promoter token; the events
// builder (/admin/events) uses the admin actions with the signed-in staffer's
// Supabase access token.
// =============================================================

import { supabase } from "@/lib/supabase";

const FN = "https://rntcujcpsozvuxvmlejv.supabase.co/functions/v1/promoter";

export type PromoterBuyer = {
  name: string;
  qty: number;
  status: string;
  at: string;
};
export type PromoterNote = {
  id: string;
  author: "promoter" | "office";
  body: string;
  at: string;
  read_at: string | null;
};
export type PromoterEvent = {
  id: string;
  name: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  poster_url: string | null;
  category: string;
  subcategory: string | null;
  maxAttendees: number | null;
  registrationOpen: boolean;
  bookable: boolean;
  requiresTicket: boolean;
  externalLink: string | null;
  shareUrl: string;
  pricePence: number | null;
  soldTickets: number;
  pendingTickets: number;
  revenuePence: number;
  buyers: PromoterBuyer[];
  notes: PromoterNote[];
};
export type PromoterSession = {
  token: string;
  promoter: { email: string; name: string | null };
  events: PromoterEvent[];
};

async function call(payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(data?.error || "Something went wrong.");
  return data;
}

// ── Promoter-facing (portal) ────────────────────────────────────────────────
export function promoterLogin(email: string, password: string): Promise<PromoterSession> {
  return call({ action: "login", email, password });
}
export function promoterLoad(token: string): Promise<PromoterSession> {
  return call({ action: "load", token });
}
export function promoterAddNote(token: string, eventId: string, body: string): Promise<{ ok: true }> {
  return call({ action: "addNote", token, event_id: eventId, body });
}

// ── Admin-facing (events builder) ───────────────────────────────────────────
// Pull the signed-in staffer's Supabase access token so the edge function can
// confirm an authorised caller. Null (not signed in) makes the admin calls 401.
async function accessToken(): Promise<string> {
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token ?? "";
}

export type PromoterAssignment = {
  email: string;
  name: string | null;
  welcome_sent_at: string | null;
  assigned_at: string;
};
export type AdminEventPromoters = {
  promoters: PromoterAssignment[];
  notes: {
    id: string;
    author: "promoter" | "office";
    author_email: string | null;
    body: string;
    created_at: string;
    read_at: string | null;
  }[];
};

export async function adminGetPromoters(eventId: string): Promise<AdminEventPromoters> {
  return call({ action: "adminGet", event_id: eventId, accessToken: await accessToken() });
}
export async function adminAssignPromoter(
  eventId: string,
  email: string,
  name: string,
  password: string,
): Promise<{ ok: true; emailed: boolean; emailError: string | null }> {
  return call({ action: "adminAssign", event_id: eventId, email, name, password, accessToken: await accessToken() });
}
export async function adminUnassignPromoter(eventId: string, email: string): Promise<{ ok: true }> {
  return call({ action: "adminUnassign", event_id: eventId, email, accessToken: await accessToken() });
}
export async function adminResendPromoter(email: string): Promise<{ ok: boolean; emailError: string | null }> {
  return call({ action: "adminResend", email, accessToken: await accessToken() });
}
export async function adminReplyPromoterNote(eventId: string, body: string): Promise<{ ok: true }> {
  return call({ action: "adminNote", event_id: eventId, body, accessToken: await accessToken() });
}
