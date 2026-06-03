"use client";

import { supabase } from "@/lib/supabase";

export type VoucherStatus = "active" | "redeemed" | "expired" | "cancelled";

export type DbVoucher = {
  id: string;
  code: string;
  value_pence: number;
  balance_pence: number;
  issued_to_name: string | null;
  issued_to_email: string | null;
  expires_at: string;
  status: VoucherStatus;
};

export async function loadVouchers(): Promise<DbVoucher[]> {
  const { data, error } = await supabase()
    .from("vouchers")
    .select(
      "id, code, value_pence, balance_pence, issued_to_name, issued_to_email, expires_at, status",
    )
    .order("expires_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbVoucher[];
}

function randomVoucherCode(): string {
  const r = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GIFT-${r()}-${r()}`;
}

export async function createVoucher(
  row: Omit<DbVoucher, "id" | "code" | "balance_pence" | "status"> & {
    code?: string;
  },
): Promise<DbVoucher> {
  const payload = {
    code: row.code ?? randomVoucherCode(),
    value_pence: row.value_pence,
    balance_pence: row.value_pence,
    issued_to_name: row.issued_to_name,
    issued_to_email: row.issued_to_email,
    expires_at: row.expires_at,
    status: "active" as VoucherStatus,
  };
  const { data, error } = await supabase()
    .from("vouchers")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as DbVoucher;
}

export async function updateVoucher(
  id: string,
  patch: Partial<Omit<DbVoucher, "id">>,
): Promise<DbVoucher> {
  const { data, error } = await supabase()
    .from("vouchers")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbVoucher;
}
