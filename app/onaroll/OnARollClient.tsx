"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { getStripe, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/stripe";

// ── On A Roll diner kit (Lucky Chip style) ──────────────────────────────────
const CREAM = "#fdf2e0", BLUE = "#183fa0", RED = "#e0231b", GREEN = "#1f8a4d",
  INK = "#15305c", LINE = "#e3d6b6", MUTED = "#8a7f63";
const HEAVY = "Impact, 'Arial Narrow Bold', 'Haettenschweiler', sans-serif";
const LOGO = "/onaroll-logo.png";

// The 14 FSA allergens + mushroom — mirrors src/kitchen/allergens.js in the team hub.
const ALLERGENS: { key: string; label: string }[] = [
  { key: "celery", label: "Celery" }, { key: "gluten", label: "Gluten" },
  { key: "crustaceans", label: "Crustaceans" }, { key: "eggs", label: "Eggs" },
  { key: "fish", label: "Fish" }, { key: "lupin", label: "Lupin" },
  { key: "milk", label: "Milk" }, { key: "molluscs", label: "Molluscs" },
  { key: "mustard", label: "Mustard" }, { key: "nuts", label: "Nuts" },
  { key: "peanuts", label: "Peanuts" }, { key: "sesame", label: "Sesame" },
  { key: "soya", label: "Soya" }, { key: "sulphites", label: "Sulphites" },
  { key: "mushroom", label: "Mushroom" },
];
const allergenLabel = (k: string) => ALLERGENS.find((a) => a.key === k)?.label || k;

const gbp = (pence: number) => "£" + (pence % 100 === 0 ? String(pence / 100) : (pence / 100).toFixed(2));

// ── types ───────────────────────────────────────────────────────────────────
type Addon = { id: string; name: string; price_pence: number };
type Item = {
  id: string; name: string; sell_pence: number; desc?: string; img?: string;
  addons?: Addon[]; allergens?: Record<string, "contains" | "trace">;
};
type Section = { id: string; name: string; items: Item[] };
type CartLine = { uid: string; item: Item; qty: number; addons: Addon[] };

async function api(fn: string, body: unknown, auth = false) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) { headers.apikey = SUPABASE_ANON_KEY; headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`; }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST", headers, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

const lineUnit = (l: CartLine) => l.item.sell_pence + l.addons.reduce((s, a) => s + a.price_pence, 0);
const lineTotal = (l: CartLine) => lineUnit(l) * l.qty;

export default function OnARollClient() {
  const [sections, setSections] = useState<Section[] | null>(null);
  const [status, setStatus] = useState<{ open: boolean; waiting?: number } | null>(null);
  const [err, setErr] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [picking, setPicking] = useState<Item | null>(null);   // item add-on sheet
  const [phase, setPhase] = useState<"menu" | "cart" | "allergy" | "details" | "pay" | "done">("menu");

  // checkout details
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [declared, setDeclared] = useState<Set<string>>(new Set());
  const [noAllergies, setNoAllergies] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderNo, setOrderNo] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Returned from a 3-D Secure redirect? Stripe appends redirect_status.
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get("redirect_status") === "succeeded") setPhase("done");
    } catch { /* ignore */ }
    (async () => {
      try {
        const [m, s] = await Promise.all([api("menu", { action: "getMenu" }), api("food-order", { action: "getStatus" })]);
        setSections((m.sections || []).filter((sec: Section) => (sec.items || []).some((it) => it.name)));
        setStatus({ open: !!s.open, waiting: s.waiting });
      } catch (e) { setErr((e as Error).message); }
    })();
  }, []);

  const total = useMemo(() => cart.reduce((s, l) => s + lineTotal(l), 0), [cart]);
  const count = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);

  // Which cart items flag a declared allergen (for the allergy gate).
  const flagged = useMemo(() => {
    if (noAllergies || declared.size === 0) return [];
    const rows: { name: string; contains: string[]; trace: string[] }[] = [];
    for (const l of cart) {
      const al = l.item.allergens || {};
      const contains: string[] = [], trace: string[] = [];
      for (const k of declared) {
        if (al[k] === "contains") contains.push(allergenLabel(k));
        else if (al[k] === "trace") trace.push(allergenLabel(k));
      }
      if (contains.length || trace.length) rows.push({ name: l.item.name, contains, trace });
    }
    return rows;
  }, [cart, declared, noAllergies]);

  const addToCart = (item: Item, addons: Addon[], qty: number) => {
    setCart((c) => [...c, { uid: `${item.id}-${Date.now()}-${c.length}`, item, qty, addons }]);
    setPicking(null);
  };
  const setQty = (uid: string, q: number) =>
    setCart((c) => c.flatMap((l) => (l.uid === uid ? (q <= 0 ? [] : [{ ...l, qty: q }]) : [l])));

  const allergyNote = () => {
    if (noAllergies) return null;
    if (declared.size === 0) return null;
    return `ALLERGIES: ${[...declared].map(allergenLabel).join(", ")} — customer accepted cross-contamination risk.`;
  };

  const startPayment = async () => {
    setBusy(true); setErr("");
    try {
      const r = await api("food-order-checkout", {
        name: name.trim(), phone: phone.trim(), allergen_note: allergyNote(),
        cart: cart.map((l) => ({ id: l.item.id, qty: l.qty, addon_ids: l.addons.map((a) => a.id) })),
      }, true);
      setClientSecret(r.client_secret); setOrderNo(r.order_no); setPhase("pay");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  // ── shell ──────────────────────────────────────────────────────────────────
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div style={{ minHeight: "100vh", background: CREAM, color: INK, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ background: CREAM, padding: "16px 16px 14px", textAlign: "center", borderBottom: `3px solid ${BLUE}` }}>
        <img src={LOGO} alt="On A Roll" style={{ height: 60, maxWidth: "72%" }} />
      </div>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 14px 140px" }}>{children}</div>
    </div>
  );

  if (err && !sections) return <Shell><Note>Couldn't load the menu — {err}</Note></Shell>;
  if (!sections || !status) return <Shell><div style={{ color: MUTED, padding: "40px 0", textAlign: "center" }}>Loading the menu…</div></Shell>;

  // Paused → waitlist
  if (!status.open && phase === "menu") return <Shell><Paused waiting={status.waiting} /></Shell>;

  // ── DONE ─────────────────────────────────────────────────────────────────
  if (phase === "done") return (
    <Shell>
      <div style={{ textAlign: "center", padding: "26px 0" }}>
        <div style={{ fontFamily: HEAVY, fontSize: 30, color: GREEN }}>✓ Order in!</div>
        {orderNo != null && <div style={{ fontFamily: HEAVY, fontSize: 64, color: RED, lineHeight: 1.1, margin: "6px 0" }}>#{orderNo}</div>}
        <p style={{ fontSize: 16, lineHeight: 1.5, color: INK, maxWidth: 340, margin: "10px auto" }}>
          Thanks{name.trim() ? " " + name.split(" ")[0] : ""}! We're on it. <b>We'll text you the second it's ready to collect{phone.trim() ? ` (${phone})` : ""}.</b> Keep an eye on your phone.
        </p>
        <button onClick={() => { setCart([]); setPhase("menu"); setClientSecret(null); setOrderNo(null); setDeclared(new Set()); setNoAllergies(false); setAccepted(false); setName(""); setPhone(""); }}
          style={btn(BLUE, "#fff")}>Order something else</button>
      </div>
    </Shell>
  );

  // ── PAY ──────────────────────────────────────────────────────────────────
  if (phase === "pay" && clientSecret) {
    const options: StripeElementsOptions = {
      clientSecret,
      appearance: { theme: "flat", variables: { colorPrimary: RED, colorText: INK, fontFamily: "DM Sans, system-ui, sans-serif", borderRadius: "10px" } },
    };
    return (
      <Shell>
        <Head>Pay {gbp(total)}</Head>
        <p style={{ fontSize: 13.5, color: MUTED, margin: "0 0 12px" }}>{count} item{count > 1 ? "s" : ""} · we'll text you when it's ready.</p>
        <Elements stripe={getStripe()} options={options}>
          <PayForm total={total} onSuccess={() => setPhase("done")} onBack={() => setPhase("details")} onError={setErr} />
        </Elements>
        {err && <Note>{err}</Note>}
      </Shell>
    );
  }

  // ── DETAILS ──────────────────────────────────────────────────────────────
  if (phase === "details") {
    const ok = name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 10;
    return (
      <Shell>
        <Back onClick={() => setPhase("allergy")} />
        <Head>Almost there</Head>
        <Label>Your name</Label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" style={field} />
        <Label>Mobile number</Label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="07…" style={field} />
        <p style={{ fontSize: 12.5, color: MUTED, margin: "6px 2px 16px" }}>We only use this to text you when your food's ready.</p>
        {err && <Note>{err}</Note>}
        <button disabled={!ok || busy} onClick={startPayment} style={{ ...btn(ok ? RED : LINE, "#fff"), opacity: ok ? 1 : 0.6 }}>
          {busy ? "One sec…" : `Continue to pay ${gbp(total)}`}
        </button>
      </Shell>
    );
  }

  // ── ALLERGY GATE ─────────────────────────────────────────────────────────
  if (phase === "allergy") {
    const declaredAndFlagged = !noAllergies && declared.size > 0;
    const canProceed = noAllergies || declared.size === 0 || accepted;
    return (
      <Shell>
        <Back onClick={() => setPhase("cart")} />
        <Head>Any allergies?</Head>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: INK, margin: "0 0 14px" }}>
          We cook in one small kitchen with a <b>shared fryer and shared surfaces</b>, handling gluten, milk, egg, mustard, celery, soya, sesame and nuts every day — so we <b>cannot guarantee</b> any dish is completely free from any allergen, even if it isn't listed.
        </p>
        <button onClick={() => { setNoAllergies(true); setDeclared(new Set()); setAccepted(false); }}
          style={{ ...chip(noAllergies, GREEN), width: "100%", padding: "12px", fontSize: 15, marginBottom: 14 }}>
          {noAllergies ? "✓ " : ""}No allergies — I'm good to order
        </button>
        <div style={{ fontSize: 12.5, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", margin: "4px 2px 8px" }}>…or tell us what to flag</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
          {ALLERGENS.map((a) => {
            const on = declared.has(a.key);
            return (
              <button key={a.key} onClick={() => setDeclared((d) => { const n = new Set(d); n.has(a.key) ? n.delete(a.key) : n.add(a.key); return n; })}
                style={chip(on && !noAllergies, RED)} disabled={noAllergies}>
                {on && !noAllergies ? "✓ " : ""}{a.label}
              </button>
            );
          })}
        </div>

        {declaredAndFlagged && (
          flagged.length ? (
            <div style={{ border: `2px solid ${RED}`, borderRadius: 12, padding: "13px", marginBottom: 14, background: "#fff" }}>
              <div style={{ fontFamily: HEAVY, color: RED, fontSize: 18, marginBottom: 6 }}>⚠ Heads up about your order</div>
              {flagged.map((f) => (
                <div key={f.name} style={{ fontSize: 14, lineHeight: 1.45, marginBottom: 5 }}>
                  <b>{f.name}</b>
                  {f.contains.length ? <> contains <b style={{ color: RED }}>{f.contains.join(", ")}</b></> : null}
                  {f.contains.length && f.trace.length ? " and" : null}
                  {f.trace.length ? <> may contain <b style={{ color: "#b8860b" }}>{f.trace.join(", ")}</b> (cross-contact)</> : null}.
                </div>
              ))}
            </div>
          ) : (
            <div style={{ border: `2px solid ${GREEN}`, borderRadius: 12, padding: "12px", marginBottom: 14, background: "#fff", fontSize: 14 }}>
              None of the items in your order are flagged for {[...declared].map(allergenLabel).join(", ")} — but the shared-kitchen warning above still applies.
            </div>
          )
        )}

        {declaredAndFlagged && (
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, lineHeight: 1.4, margin: "0 2px 16px", cursor: "pointer" }}>
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18 }} />
            <span>I understand the cross-contamination risk in this small kitchen and I accept it. <span style={{ color: MUTED }}>(If your allergy is severe, please don't order — talk to us at the truck instead.)</span></span>
          </label>
        )}

        <button disabled={!canProceed} onClick={() => setPhase("details")} style={{ ...btn(canProceed ? RED : LINE, "#fff"), opacity: canProceed ? 1 : 0.6 }}>
          {noAllergies || declared.size === 0 ? "Continue" : accepted ? "I accept — continue" : "Tick the box to continue"}
        </button>
      </Shell>
    );
  }

  // ── CART ─────────────────────────────────────────────────────────────────
  if (phase === "cart") return (
    <Shell>
      <Back onClick={() => setPhase("menu")} />
      <Head>Your order</Head>
      {cart.length === 0 ? <p style={{ color: MUTED }}>Nothing here yet.</p> : cart.map((l) => (
        <div key={l.uid} style={{ display: "flex", gap: 10, alignItems: "flex-start", borderBottom: `1px solid ${LINE}`, padding: "11px 0" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{l.item.name}</div>
            {l.addons.map((a) => <div key={a.id} style={{ fontSize: 12.5, color: MUTED }}>+ {a.name} ({gbp(a.price_pence)})</div>)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setQty(l.uid, l.qty - 1)} style={qtyBtn}>−</button>
            <span style={{ fontFamily: HEAVY, fontSize: 18, minWidth: 18, textAlign: "center" }}>{l.qty}</span>
            <button onClick={() => setQty(l.uid, l.qty + 1)} style={qtyBtn}>+</button>
          </div>
          <div style={{ fontFamily: HEAVY, color: RED, fontSize: 17, minWidth: 52, textAlign: "right" }}>{gbp(lineTotal(l))}</div>
        </div>
      ))}
      {cart.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "16px 0" }}>
            <span style={{ fontFamily: HEAVY, fontSize: 22 }}>Total</span>
            <span style={{ fontFamily: HEAVY, fontSize: 26, color: RED }}>{gbp(total)}</span>
          </div>
          <button onClick={() => setPhase("allergy")} style={btn(RED, "#fff")}>Checkout</button>
          <button onClick={() => setPhase("menu")} style={{ ...btn("transparent", BLUE), border: `2px solid ${BLUE}`, marginTop: 10 }}>Add more</button>
        </>
      )}
    </Shell>
  );

  // ── MENU ─────────────────────────────────────────────────────────────────
  return (
    <Shell>
      {picking && <AddonSheet item={picking} onClose={() => setPicking(null)} onAdd={addToCart} />}
      {sections.map((sec) => (
        <div key={sec.id} style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: HEAVY, fontSize: 24, color: BLUE, borderBottom: `2px solid ${BLUE}`, paddingBottom: 4, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>{sec.name}</div>
          {sec.items.filter((it) => it.name).map((it) => (
            <div key={it.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: `1px solid ${LINE}` }}>
              {it.img ? <img src={it.img} alt="" style={{ width: 66, height: 66, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} /> : null}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 16 }}>{it.name}</span>
                  <span style={{ fontFamily: HEAVY, color: RED, fontSize: 18 }}>{gbp(it.sell_pence)}</span>
                </div>
                {it.desc && <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.4, margin: "3px 0" }}>{it.desc}</div>}
                <AllergenTags allergens={it.allergens} />
                <button onClick={() => (it.addons && it.addons.length ? setPicking(it) : addToCart(it, [], 1))} style={{ ...btn(BLUE, "#fff"), padding: "8px 16px", marginTop: 7, width: "auto", display: "inline-block" }}>
                  Add{it.addons && it.addons.length ? " +" : ""}
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
      {count > 0 && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: "12px 14px", background: CREAM, borderTop: `2px solid ${BLUE}` }}>
          <button onClick={() => setPhase("cart")} style={{ ...btn(RED, "#fff"), maxWidth: 560, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>View order · {count} item{count > 1 ? "s" : ""}</span><span>{gbp(total)}</span>
          </button>
        </div>
      )}
    </Shell>
  );
}

// ── Stripe form ───────────────────────────────────────────────────────────
function PayForm({ total, onSuccess, onBack, onError }: { total: number; onSuccess: () => void; onBack: () => void; onError: (m: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [inlineErr, setInlineErr] = useState("");

  const pay = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true); setInlineErr("");
    const { error: submitError } = await elements.submit();
    if (submitError) { setInlineErr(submitError.message || "Check your card details."); setSubmitting(false); return; }
    const { error } = await stripe.confirmPayment({
      elements, redirect: "if_required",
      confirmParams: { return_url: `${window.location.origin}/onaroll/` },
    });
    if (error) {
      if (error.type === "card_error" || error.type === "validation_error") setInlineErr(error.message || "Card declined.");
      else onError(error.message || "Payment failed — please try again.");
      setSubmitting(false); return;
    }
    onSuccess();
  };

  return (
    <div>
      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <PaymentElement options={{ layout: "tabs", wallets: { applePay: "auto", googlePay: "auto" } }} />
      </div>
      {inlineErr && <Note>{inlineErr}</Note>}
      <button disabled={submitting || !stripe} onClick={pay} style={btn(RED, "#fff")}>{submitting ? "Processing…" : `Pay ${gbp(total)}`}</button>
      <button onClick={onBack} style={{ ...btn("transparent", MUTED), marginTop: 8 }}>Back</button>
    </div>
  );
}

// ── add-on sheet ──────────────────────────────────────────────────────────
function AddonSheet({ item, onClose, onAdd }: { item: Item; onClose: () => void; onAdd: (i: Item, a: Addon[], q: number) => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState(1);
  const addons = item.addons || [];
  const chosen = addons.filter((a) => sel.has(a.id));
  const unit = item.sell_pence + chosen.reduce((s, a) => s + a.price_pence, 0);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(21,48,92,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: CREAM, width: "100%", maxWidth: 560, borderRadius: "18px 18px 0 0", padding: "18px 16px 20px", maxHeight: "82vh", overflowY: "auto" }}>
        <div style={{ fontFamily: HEAVY, fontSize: 24, color: INK }}>{item.name}</div>
        {item.desc && <div style={{ fontSize: 13, color: MUTED, margin: "3px 0 12px", lineHeight: 1.4 }}>{item.desc}</div>}
        <div style={{ fontSize: 12.5, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Add extras</div>
        {addons.map((a) => {
          const on = sel.has(a.id);
          return (
            <button key={a.id} onClick={() => setSel((s) => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })}
              style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "11px 13px", borderRadius: 10, marginBottom: 8, cursor: "pointer",
                border: `2px solid ${on ? RED : LINE}`, background: on ? "#fff" : "transparent", fontSize: 15, fontWeight: 700, color: INK }}>
              <span>{on ? "✓ " : ""}{a.name}</span><span style={{ color: RED }}>+{gbp(a.price_pence)}</span>
            </button>
          );
        })}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0" }}>
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={qtyBtn}>−</button>
          <span style={{ fontFamily: HEAVY, fontSize: 22, minWidth: 24, textAlign: "center" }}>{qty}</span>
          <button onClick={() => setQty((q) => q + 1)} style={qtyBtn}>+</button>
        </div>
        <button onClick={() => onAdd(item, chosen, qty)} style={btn(RED, "#fff")}>Add {qty} · {gbp(unit * qty)}</button>
      </div>
    </div>
  );
}

function AllergenTags({ allergens }: { allergens?: Record<string, "contains" | "trace"> }) {
  const keys = Object.keys(allergens || {});
  if (!keys.length) return null;
  const contains = keys.filter((k) => allergens![k] === "contains").map(allergenLabel);
  if (!contains.length) return null;
  return <div style={{ fontSize: 11.5, color: "#b25", marginTop: 2 }}>Contains: {contains.join(", ")}</div>;
}

function Paused({ waiting }: { waiting?: number }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false); const [busy, setBusy] = useState(false); const [e, setE] = useState("");
  const join = async () => {
    setBusy(true); setE("");
    try { await api("food-order", { action: "joinWaitlist", name: name.trim(), phone: phone.trim() }); setDone(true); }
    catch (er) { setE((er as Error).message); } finally { setBusy(false); }
  };
  if (done) return (
    <div style={{ textAlign: "center", padding: "30px 0" }}>
      <div style={{ fontFamily: HEAVY, fontSize: 26, color: GREEN }}>You're on the list ✓</div>
      <p style={{ fontSize: 15, lineHeight: 1.5, maxWidth: 320, margin: "10px auto", color: INK }}>We'll text {phone} the moment we're ready to take your order. Hang tight!</p>
    </div>
  );
  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ fontFamily: HEAVY, fontSize: 28, color: RED }}>A few orders ahead!</div>
      <p style={{ fontSize: 15, lineHeight: 1.5, maxWidth: 340, margin: "10px auto 18px", color: INK }}>
        We're slammed right now{typeof waiting === "number" && waiting > 0 ? ` (${waiting} waiting)` : ""}. Leave your number and we'll <b>text you the second you can order again</b>.
      </p>
      <input value={name} onChange={(ev) => setName(ev.target.value)} placeholder="First name" style={field} />
      <input value={phone} onChange={(ev) => setPhone(ev.target.value)} inputMode="tel" placeholder="07…" style={field} />
      {e && <Note>{e}</Note>}
      <button disabled={busy || phone.replace(/\D/g, "").length < 10} onClick={join} style={btn(RED, "#fff")}>{busy ? "…" : "Text me when it's my turn"}</button>
    </div>
  );
}

// ── little pieces ──────────────────────────────────────────────────────────
const Head = ({ children }: { children: React.ReactNode }) => <h1 style={{ fontFamily: HEAVY, fontSize: 30, color: INK, margin: "2px 0 12px", letterSpacing: "0.5px" }}>{children}</h1>;
const Label = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 12.5, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", margin: "10px 2px 5px" }}>{children}</div>;
const Note = ({ children }: { children: React.ReactNode }) => <div style={{ background: "#fff", border: `1px solid ${RED}`, color: RED, borderRadius: 10, padding: "10px 12px", fontSize: 13.5, margin: "10px 0", lineHeight: 1.4 }}>{children}</div>;
const Back = ({ onClick }: { onClick: () => void }) => <button onClick={onClick} style={{ background: "none", border: "none", color: BLUE, fontWeight: 700, fontSize: 14, cursor: "pointer", padding: "4px 0 8px" }}>← Back</button>;

const btn = (bg: string, color: string): React.CSSProperties => ({ width: "100%", border: "none", borderRadius: 11, padding: "13px", fontFamily: HEAVY, fontSize: 18, letterSpacing: "0.5px", textTransform: "uppercase", cursor: "pointer", background: bg, color });
const chip = (on: boolean, accent: string): React.CSSProperties => ({ fontSize: 13.5, padding: "8px 12px", borderRadius: 999, cursor: "pointer", fontWeight: 700, border: `2px solid ${on ? accent : LINE}`, background: on ? "#fff" : "transparent", color: on ? accent : INK });
const qtyBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 999, border: `2px solid ${BLUE}`, background: "#fff", color: BLUE, fontSize: 20, fontWeight: 800, cursor: "pointer", lineHeight: 1 };
const field: React.CSSProperties = { width: "100%", padding: "12px 13px", borderRadius: 10, border: `1.5px solid ${LINE}`, background: "#fff", color: INK, fontSize: 16, marginBottom: 10, boxSizing: "border-box" };
