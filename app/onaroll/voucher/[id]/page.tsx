"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { SUPABASE_URL } from "@/lib/stripe";

// ── 🍺 On A Roll drinks voucher ──────────────────────────────────────────────
// The short-life page the customer opens from the 🍺 DRINKS VOUCHER link in their
// order-confirmation text. They SHOW it to the bar staff, who HOLD the button on
// the phone to redeem it. Single-use, valid tonight only. Styled to match the On A
// Roll order page (diner kit), not the staff hub.
const CREAM = "#fdf2e0", BLUE = "#183fa0", RED = "#e0231b", GREEN = "#1f8a4d",
  INK = "#15305c", MUTED = "#8a7f63";
const HEAVY = "Impact, 'Arial Narrow Bold', 'Haettenschweiler', sans-serif";
const HOLD_MS = 1600;

async function call(action: string, id: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/food-order`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, id }),
  });
  return res.json().catch(() => ({}));
}

type Deal = { name: string; qty: number };
type V = {
  loaded: boolean; exists: boolean; order_no?: number; deals?: Deal[];
  redeemed_at?: string | null; valid?: boolean;
};

export default function VoucherPage() {
  const params = useParams();
  const id = String((params as any)?.id || "");
  const [v, setV] = useState<V>({ loaded: false, exists: false });
  const [redeemed, setRedeemed] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);   // 0–1 while holding
  const timer = useRef<number | null>(null);
  const raf = useRef<number | null>(null);
  const startedAt = useRef(0);

  const load = useCallback(async () => {
    const r = await call("drinkVoucher", id);
    setV({ loaded: true, exists: !!r.exists, order_no: r.order_no, deals: r.deals, redeemed_at: r.redeemed_at, valid: r.valid });
    if (r.redeemed_at) setRedeemed(r.redeemed_at);
    if (r.exists && r.valid === false && !r.redeemed_at) setExpired(true);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const doRedeem = useCallback(async () => {
    if (busy || redeemed) return;
    setBusy(true);
    try {
      const r = await call("redeemDrinkVoucher", id);
      if (r.expired) { setExpired(true); }
      else if (r.redeemed) { setRedeemed(r.redeemed_at || new Date().toISOString()); }
      else if (r.error) { alert(r.error); }
    } finally { setBusy(false); setProgress(0); }
  }, [busy, redeemed, id]);

  // Press-and-hold mechanics: a tick animates the fill; completing it redeems.
  const startHold = () => {
    if (busy || redeemed || expired) return;
    startedAt.current = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - startedAt.current) / HOLD_MS);
      setProgress(p);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    timer.current = window.setTimeout(() => { cancelHold(); doRedeem(); }, HOLD_MS);
  };
  const cancelHold = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (raf.current) { cancelAnimationFrame(raf.current); raf.current = null; }
    if (!busy) setProgress(0);
  };
  useEffect(() => () => cancelHold(), []);   // cleanup on unmount

  const wrap: React.CSSProperties = {
    minHeight: "100dvh", background: CREAM, color: INK,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    padding: "28px 18px", textAlign: "center",
  };
  const card: React.CSSProperties = {
    width: "100%", maxWidth: 440, background: "#fff", borderRadius: 20,
    border: `3px solid ${INK}`, padding: "26px 22px 30px", boxShadow: "0 12px 34px rgba(21,48,92,0.18)",
  };

  if (!v.loaded) return <div style={wrap}><div style={{ color: MUTED, fontSize: 16 }}>Loading your voucher…</div></div>;

  if (!v.exists) return (
    <div style={wrap}><div style={card}>
      <div style={{ fontSize: 46 }}>🍺</div>
      <div style={{ fontFamily: HEAVY, fontSize: 30, letterSpacing: "0.5px", marginTop: 6 }}>No voucher here</div>
      <p style={{ color: MUTED, fontSize: 15, lineHeight: 1.5, marginTop: 10 }}>This link doesn&apos;t have a drinks voucher on it. If you ordered a deal, open the newest link in your confirmation text.</p>
    </div></div>
  );

  const dealNames = (v.deals || []).map((d) => d.qty > 1 ? `${d.name} ×${d.qty}` : d.name);

  return (
    <div style={wrap}>
      <div style={card}>
        {/* Header */}
        <div style={{ fontSize: 40, lineHeight: 1 }}>🍺</div>
        <div style={{ fontFamily: HEAVY, fontSize: 34, letterSpacing: "1px", color: RED, marginTop: 4, textTransform: "uppercase" }}>Drinks Voucher</div>
        <div style={{ fontSize: 13, color: MUTED, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 2 }}>On A Roll · Order #{v.order_no}</div>

        {/* The deal(s) */}
        <div style={{ margin: "20px 0", padding: "16px 14px", border: `2px dashed ${INK}`, borderRadius: 14, background: "rgba(24,63,160,0.04)" }}>
          {dealNames.map((n, i) => (
            <div key={i} style={{ fontFamily: HEAVY, fontSize: 24, color: INK, lineHeight: 1.15 }}>{n}</div>
          ))}
          <div style={{ fontSize: 13, color: MUTED, marginTop: 6 }}>Poured at the bar</div>
        </div>

        {redeemed ? (
          <div style={{ padding: "22px 14px", borderRadius: 16, background: GREEN, color: "#fff" }}>
            <div style={{ fontSize: 40 }}>✓</div>
            <div style={{ fontFamily: HEAVY, fontSize: 30, letterSpacing: "1px", textTransform: "uppercase" }}>Redeemed</div>
            <div style={{ fontSize: 14, marginTop: 6, opacity: 0.95 }}>
              {new Date(redeemed).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} — enjoy! 🍻
            </div>
          </div>
        ) : expired ? (
          <div style={{ padding: "20px 14px", borderRadius: 16, background: "#efe6cf", color: "#8a7f63" }}>
            <div style={{ fontFamily: HEAVY, fontSize: 26, letterSpacing: "0.5px", textTransform: "uppercase" }}>Expired</div>
            <div style={{ fontSize: 14, marginTop: 6 }}>Drinks vouchers are for the night you ordered only.</div>
          </div>
        ) : (
          <>
            <div style={{ fontFamily: HEAVY, fontSize: 20, color: INK, textTransform: "uppercase", letterSpacing: "0.5px" }}>Show this to the bar staff</div>
            <p style={{ fontSize: 14.5, color: MUTED, lineHeight: 1.5, margin: "8px 0 16px" }}>
              Hand your phone to the team at the bar. <b style={{ color: INK }}>In front of bar staff</b>, press and <b style={{ color: INK }}>HOLD</b> the button to redeem.
            </p>

            {/* Hold-to-redeem button */}
            <button
              onPointerDown={(e) => { e.preventDefault(); startHold(); }}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              onPointerCancel={cancelHold}
              onContextMenu={(e) => e.preventDefault()}
              disabled={busy}
              style={{
                position: "relative", width: "100%", border: "none", borderRadius: 16,
                padding: "22px 16px", cursor: "pointer", overflow: "hidden",
                background: INK, color: "#fff", touchAction: "none", userSelect: "none",
                WebkitUserSelect: "none", WebkitTouchCallout: "none",
              }}
            >
              <span style={{ position: "absolute", inset: 0, width: `${progress * 100}%`, background: RED, transition: progress === 0 ? "width 0.2s ease-out" : "none" }} />
              <span style={{ position: "relative", fontFamily: HEAVY, fontSize: 24, letterSpacing: "1px", textTransform: "uppercase" }}>
                {busy ? "Redeeming…" : progress > 0 ? "Keep holding…" : "Hold to redeem"}
              </span>
            </button>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 12 }}>One use · tonight only</div>
          </>
        )}
      </div>
    </div>
  );
}
