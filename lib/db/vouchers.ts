"use client";

import { supabase } from "@/lib/supabase";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/stripe";

export type VoucherStatus = "active" | "redeemed" | "expired" | "cancelled";
// "auction" = an activity/experience prize (no cash value) — e.g. a round of
// mini golf + drinks for 6. It carries prize_description instead of a value.
export type VoucherKind = "gift" | "comp" | "raffle" | "auction";

export type DbVoucher = {
  id: string;
  code: string;
  value_pence: number;
  balance_pence: number;
  prize_description: string | null;
  issued_to_name: string | null;
  issued_to_email: string | null;
  issued_to_phone: string | null;
  kind: VoucherKind;
  note: string | null;
  poster_url: string | null;
  image_url: string | null;
  image_locked: boolean;
  expires_at: string;
  status: VoucherStatus;
  first_redeemed_on: string | null;
  redeemed_at: string | null;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type VoucherRedemption = {
  id: string;
  voucher_id: string;
  redeemed_at: string;
  amount_pence: number;
  balance_after_pence: number;
  staff: string | null;
  note: string | null;
};

const SELECT =
  "id, code, value_pence, balance_pence, prize_description, issued_to_name, issued_to_email, issued_to_phone, kind, note, poster_url, image_url, image_locked, expires_at, status, first_redeemed_on, redeemed_at, sent_at, created_by, created_at";

export async function loadVouchers(): Promise<DbVoucher[]> {
  const { data, error } = await supabase()
    .from("vouchers")
    .select(SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbVoucher[];
}

// ── Voucher codes ────────────────────────────────────────────────────────────
// The code printed on the artwork IS the key the till redeems on, so it has to
// be unguessable and unambiguous. A 10-char code from a 32-letter Crockford-ish
// alphabet (no 0/O/1/I — the letters people misread) over ~1.1e15 combinations,
// grouped for reading. The DB has a UNIQUE index on code; createVoucher retries
// on the (vanishingly unlikely) collision.
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function generateVoucherCode(): string {
  const n = 10;
  const out: string[] = [];
  const buf = new Uint32Array(n);
  (globalThis.crypto || (window as unknown as { crypto: Crypto }).crypto).getRandomValues(buf);
  for (let i = 0; i < n; i++) out.push(CODE_ALPHABET[buf[i] % CODE_ALPHABET.length]);
  const s = out.join("");
  return `ND-${s.slice(0, 5)}-${s.slice(5)}`;
}

export type NewVoucher = {
  value_pence: number;
  expires_at: string; // ISO
  kind?: VoucherKind;
  prize_description?: string | null; // auction/activity prize instead of a cash value
  issued_to_name?: string | null;
  issued_to_email?: string | null;
  issued_to_phone?: string | null;
  note?: string | null;
  poster_url?: string | null;
  image_url?: string | null;
  image_locked?: boolean;
  code?: string; // pre-generated (so the artwork + the row share it); else generated here
  created_by?: string | null;
};

export async function createVoucher(row: NewVoucher): Promise<DbVoucher> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = row.code ?? generateVoucherCode();
    const payload = {
      code,
      value_pence: row.value_pence,
      balance_pence: row.value_pence,
      prize_description: row.prize_description ?? null,
      kind: row.kind ?? "gift",
      issued_to_name: row.issued_to_name ?? null,
      issued_to_email: row.issued_to_email ?? null,
      issued_to_phone: row.issued_to_phone ?? null,
      note: row.note ?? null,
      poster_url: row.poster_url ?? null,
      image_url: row.image_url ?? null,
      image_locked: row.image_locked ?? false,
      expires_at: row.expires_at,
      status: "active" as VoucherStatus,
      created_by: row.created_by ?? null,
    };
    const { data, error } = await supabase()
      .from("vouchers")
      .insert(payload)
      .select(SELECT)
      .single();
    if (!error) return data as DbVoucher;
    // 23505 = unique_violation (code clash). Only retry when the caller let us
    // generate the code; if they pinned one, surface the error.
    const isDup =
      (error as { code?: string }).code === "23505" ||
      /duplicate key|unique/i.test(error.message || "");
    if (!isDup || row.code) throw error;
  }
  throw new Error("Could not allocate a unique voucher code — please try again.");
}

export async function updateVoucher(
  id: string,
  patch: Partial<Omit<DbVoucher, "id">>,
): Promise<DbVoucher> {
  const { data, error } = await supabase()
    .from("vouchers")
    .update(patch)
    .eq("id", id)
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as DbVoucher;
}

export async function loadVoucherRedemptions(
  voucherId: string,
): Promise<VoucherRedemption[]> {
  const { data, error } = await supabase()
    .from("voucher_redemptions")
    .select("id, voucher_id, redeemed_at, amount_pence, balance_after_pence, staff, note")
    .eq("voucher_id", voucherId)
    .order("redeemed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VoucherRedemption[];
}

// ── Shared voucher defaults (crm_settings) ───────────────────────────────────
// The founder uploads the token artwork once and LOCKS it — that choice lives
// here so every voucher the team makes starts from the same locked picture, and
// so "locked" holds across devices and logins.
export type VoucherDefaults = {
  image_url: string;
  image_locked: boolean;
  treatment: string; // "whites" = colour-through (the founder's spec)
  colour: string; // hex poster colour
};

const DEFAULTS_FALLBACK: VoucherDefaults = {
  image_url: "",
  image_locked: false,
  treatment: "whites",
  colour: "#F6A11E", // Gold — matches the token artwork
};

export async function loadVoucherDefaults(): Promise<VoucherDefaults> {
  const { data } = await supabase()
    .from("crm_settings")
    .select("key, value")
    .in("key", [
      "voucher_image_url",
      "voucher_image_locked",
      "voucher_treatment",
      "voucher_colour",
    ]);
  const map = new Map((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  return {
    image_url: map.get("voucher_image_url") ?? DEFAULTS_FALLBACK.image_url,
    image_locked: (map.get("voucher_image_locked") ?? "") === "1",
    treatment: map.get("voucher_treatment") || DEFAULTS_FALLBACK.treatment,
    colour: map.get("voucher_colour") || DEFAULTS_FALLBACK.colour,
  };
}

export async function saveVoucherDefaults(d: VoucherDefaults): Promise<void> {
  const rows = [
    { key: "voucher_image_url", value: d.image_url },
    { key: "voucher_image_locked", value: d.image_locked ? "1" : "0" },
    { key: "voucher_treatment", value: d.treatment },
    { key: "voucher_colour", value: d.colour },
  ];
  const { error } = await supabase()
    .from("crm_settings")
    .upsert(rows, { onConflict: "key" });
  if (error) throw error;
}

// ── Edge calls ───────────────────────────────────────────────────────────────
async function callEdge<T>(fn: string, body: unknown): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) || `Request failed (${res.status})`);
  return data as T;
}

// Email the voucher (its artwork, code, value and terms) to the recipient and
// stamp sent_at. The edge function holds the Resend key and attaches the PNG.
export async function sendVoucher(
  voucherId: string,
  toEmail?: string,
): Promise<{ ok: true; sent_to: string }> {
  return callEdge("voucher-send", { voucher_id: voucherId, to_email: toEmail });
}

// Read-only lookup for a verify page (the QR) — safe fields only.
export type VoucherLookup = {
  found: boolean;
  code?: string;
  value_pence?: number;
  balance_pence?: number;
  spendable_today_pence?: number;
  prize_description?: string | null;
  status?: VoucherStatus;
  expires_at?: string;
  first_redeemed_on?: string | null;
  message?: string;
};
export async function lookupVoucher(code: string): Promise<VoucherLookup> {
  return callEdge("voucher-lookup", { code });
}
