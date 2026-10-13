"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/stripe";

// ── On A Roll diner kit (same palette as OnARollClient) — but typography is the
// nodice.bar house pair: Bebas Neue (display) + Inter (body). ───────────────────
const CREAM = "#fdf2e0", BLUE = "#183fa0", RED = "#e0231b", GREEN = "#1f8a4d",
  INK = "#15305c", LINE = "#e3d6b6", MUTED = "#8a7f63";
const DISPLAY = "'Bebas Neue', Impact, 'Arial Narrow Bold', sans-serif";
const BODY = "'Inter', system-ui, -apple-system, sans-serif";
const LOGO = "/onaroll-logo.png";
const POPUP_LOGOS: Record<string, string> = { cyprus: "/cyprus-grill-logo.png" };

// Discreet staff exit: long-press the top-LEFT corner ~1.6s, then key this code.
// TODO(kiosk): make this founder-settable (food_settings.kiosk_exit_code) — hard-coded for Stage 1.
const STAFF_EXIT_CODE = "1234";
const AUTO_RESET_MS = 12000;   // DONE screen → back to menu for the next customer

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

// ── types (shared shape with OnARollClient) ─────────────────────────────────────
type Addon = { id: string; name: string; price_pence: number };
type Item = {
  id: string; name: string; sell_pence: number; desc?: string; img?: string;
  addons?: Addon[]; allergens?: Record<string, "contains" | "trace">; stock?: string[]; star?: boolean;
};
type StockLevel = { count: number; override: string | null; soldOut: boolean; label?: string };
type Section = { id: string; name: string; items: Item[] };
type Bundle = { id: string; name?: string; burger_id: string; beer_pence?: number; price_pence?: number; days?: string[]; drink?: string };
type CartLine = { uid: string; item: Item; qty: number; addons: Addon[]; bundle_id?: string };
// A menu "tile" is either a normal item or a live beer+burger deal.
type Tile = { kind: "item"; item: Item } | { kind: "deal"; bn: Bundle; burger: Item };

async function api(fn: string, body: unknown, auth = false) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) { headers.apikey = SUPABASE_ANON_KEY; headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`; }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, { method: "POST", headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || `Error ${res.status}`) as Error & { data?: any }; e.data = data; throw e; }
  return data;
}

const lineUnit = (l: CartLine) => l.item.sell_pence + l.addons.reduce((s, a) => s + a.price_pence, 0);
const lineTotal = (l: CartLine) => lineUnit(l) * l.qty;

type Phase = "menu" | "cart" | "allergy" | "details" | "tip" | "pay" | "done";

export default function KioskClient() {
  const [sections, setSections] = useState<Section[] | null>(null);
  const [status, setStatus] = useState<{ open: boolean; waiting?: number; reason?: string | null } | null>(null);
  const [levels, setLevels] = useState<Record<string, StockLevel>>({});
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [err, setErr] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [picking, setPicking] = useState<Item | null>(null);
  const [phase, setPhase] = useState<Phase>("menu");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [declared, setDeclared] = useState<Set<string>>(new Set());
  const [noAllergies, setNoAllergies] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [tipChoice, setTipChoice] = useState<"none" | "5" | "10">("none");
  const [orderNo, setOrderNo] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const [exitOpen, setExitOpen] = useState(false);

  const load = async (retry = true) => {
    setErr("");
    try {
      const [m, s, st] = await Promise.all([api("menu", { action: "getMenu" }), api("food-order", { action: "getStatus" }), api("food-order", { action: "getStock" })]);
      setSections((m.sections || [])
        .filter((sec: any) => !sec.archived)
        .map((sec: Section) => ({ ...sec, items: (sec.items || []).filter((it) => it.name && !(it as any).archived) }))
        .filter((sec: Section) => sec.items.length));
      setBundles(Array.isArray((m as any).bundles) ? (m as any).bundles : []);
      setStatus({ open: !!s.open, waiting: s.waiting, reason: s.reason ?? null });
      setLevels(st.levels || {});
    } catch (e) {
      if (retry) { setTimeout(() => load(false), 1200); return; }
      setErr((e as Error).message);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(() => {
      api("food-order", { action: "getStock" }).then((r) => setLevels(r.levels || {})).catch(() => {});
      api("food-order", { action: "getStatus" }).then((s) => setStatus({ open: !!s.open, waiting: s.waiting, reason: s.reason ?? null })).catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // DONE → auto-reset to the menu for the next customer.
  useEffect(() => {
    if (phase !== "done") return;
    const t = setTimeout(() => resetAll(), AUTO_RESET_MS);
    return () => clearTimeout(t);
  }, [phase]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── kiosk lock: no pinch-zoom, no text-select, no context menu, no gesture nav ──
  useEffect(() => {
    const noZoom = (e: Event) => e.preventDefault();
    const noCtx = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", noZoom as any, { passive: false });
    document.addEventListener("contextmenu", noCtx);
    const prevOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overscrollBehavior = "none";
    return () => {
      document.removeEventListener("gesturestart", noZoom as any);
      document.removeEventListener("contextmenu", noCtx);
      document.body.style.overscrollBehavior = prevOverscroll;
    };
  }, []);

  const avail = (it: Item): number => {
    const keys = it.stock || [];
    if (!keys.length) return Infinity;
    let min = Infinity;
    for (const k of keys) {
      const lv = levels[k];
      if (!lv) continue;
      if (lv.soldOut) return 0;
      const c = lv.override === "available" ? Infinity : lv.count;
      if (c < min) min = c;
    }
    return min;
  };

  const total = useMemo(() => cart.reduce((s, l) => s + lineTotal(l), 0), [cart]);
  const count = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);
  const tipPence = tipChoice === "5" ? Math.round(total * 0.05) : tipChoice === "10" ? Math.round(total * 0.1) : 0;
  const grand = total + tipPence;

  // Live deals (day-gated), same rule as OnARollClient.
  const deals = useMemo(() => {
    if (!sections) return [] as { bn: Bundle; burger: Item }[];
    const dow = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short" }).format(new Date());
    const items = new Map<string, Item>();
    sections.forEach((s) => s.items.forEach((it) => items.set(it.id, it)));
    return bundles
      .map((bn) => ({ bn, burger: items.get(bn.burger_id) }))
      .filter((d): d is { bn: Bundle; burger: Item } =>
        !!d.burger && (parseInt(String(d.bn.price_pence), 10) || 0) > 0 && (!d.bn.days?.length || d.bn.days.includes(dow)));
  }, [bundles, sections]);

  // ONE flat tile list that fills the screen: deals → specials → the rest.
  const tiles = useMemo<Tile[]>(() => {
    if (!sections) return [];
    const dealTiles: Tile[] = deals.map((d) => ({ kind: "deal", bn: d.bn, burger: d.burger }));
    const starred = sections.flatMap((s) => s.items.filter((it) => it.name && it.star));
    const rest = sections.flatMap((s) => s.items.filter((it) => it.name && !it.star));
    const itemTiles: Tile[] = [...starred, ...rest].map((item) => ({ kind: "item", item }));
    return [...dealTiles, ...itemTiles];
  }, [sections, deals]);

  // Columns chosen so a SHORT menu fills the portrait screen as big tiles and a
  // longer one still fits (rows share the fixed height; tiles shrink). If a menu
  // ever gets genuinely huge the tiles get small — flagged below.
  const cols = tiles.length <= 2 ? 1 : tiles.length <= 6 ? 2 : 3;
  const rows = Math.ceil(tiles.length / Math.max(1, cols));
  const tooMany = rows > 4;   // > ~12 tiles on 3 cols: readable but tight — TODO flag
  useEffect(() => {
    if (tooMany) console.warn(`[kiosk] ${tiles.length} live tiles → ${rows} rows; tiles are getting small. TODO: paginate / group the menu when it grows past one screen.`);
  }, [tooMany, tiles.length, rows]);

  const flagged = useMemo(() => {
    if (noAllergies || declared.size === 0) return [];
    const out: { name: string; contains: string[]; trace: string[] }[] = [];
    for (const l of cart) {
      const al = l.item.allergens || {};
      const contains: string[] = [], trace: string[] = [];
      for (const k of declared) { if (al[k] === "contains") contains.push(allergenLabel(k)); else if (al[k] === "trace") trace.push(allergenLabel(k)); }
      if (contains.length || trace.length) out.push({ name: l.item.name, contains, trace });
    }
    return out;
  }, [cart, declared, noAllergies]);

  const addItem = (item: Item, addons: Addon[], qty: number) => {
    setCart((c) => [...c, { uid: `${item.id}-${Date.now()}-${c.length}`, item, qty, addons }]);
    setPicking(null);
  };
  const addDeal = (bn: Bundle, burger: Item) => {
    const drink = (bn.drink && bn.drink.trim()) || "beer";
    const item: Item = {
      id: burger.id,
      name: `🎟 ${bn.name || "Beer + Burger"}: ${burger.name} + ${drink}`,
      sell_pence: parseInt(String(bn.price_pence), 10) || 0,
      allergens: burger.allergens, addons: [], stock: burger.stock,
      desc: `${burger.name} + a ${drink} — poured at the bar`,
    };
    setCart((c) => [...c, { uid: `deal-${bn.id}-${Date.now()}-${c.length}`, item, qty: 1, addons: [], bundle_id: bn.id }]);
  };
  const setQty = (uid: string, q: number) => setCart((c) => c.flatMap((l) => (l.uid === uid ? (q <= 0 ? [] : [{ ...l, qty: q }]) : [l])));

  const allergyNote = () => {
    if (noAllergies || declared.size === 0) return null;
    return `ALLERGIES: ${[...declared].map(allergenLabel).join(", ")} — customer accepted cross-contamination risk.`;
  };

  function resetAll() {
    setCart([]); setPhase("menu"); setOrderNo(null); setDeclared(new Set());
    setNoAllergies(false); setAccepted(false); setName(""); setPhone(""); setTipChoice("none"); setErr("");
  }

  // ── PAY: create the order server-side (priced server-side), then take payment ──
  // STUB today: `takePayment` marks the order paid so it runs end-to-end into the
  // kitchen + "ready" SMS. Drop-in later: the server triggers the SumUp Solo and we
  // poll `orderStatus` until paid — see supabase/functions/onaroll-kiosk.
  const takePayment = async () => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const created = await api("onaroll-kiosk", {
        action: "createOrder",
        name: name.trim(), phone: phone.trim(), allergen_note: allergyNote(),
        tip_pct: tipChoice === "5" ? 5 : tipChoice === "10" ? 10 : 0,
        cart: cart.map((l) => l.bundle_id ? { bundle_id: l.bundle_id, qty: l.qty } : { id: l.item.id, qty: l.qty, addon_ids: l.addons.map((a) => a.id) }),
      }, true);
      const paid = await api("onaroll-kiosk", { action: "takePayment", order_id: created.order_id, client_tx_id: created.client_tx_id }, true);
      if (paid.paid) { setOrderNo(created.order_no); setPhase("done"); return; }
      // Real SumUp (SUMUP_LIVE) would return { pending:true } → poll here.
      setErr("Waiting for the card reader… please tap your card.");
    } catch (e) {
      const d = (e as Error & { data?: any }).data;
      if (d && d.open === false) { setStatus({ open: false, waiting: d.waiting, reason: d.reason ?? "paused" }); setPhase("menu"); return; }
      setErr((e as Error).message || "Something went wrong — please find a staff member.");
    } finally { setBusy(false); }
  };

  const headerLogo = (sections || []).map((s) => (s as any).logoImg || POPUP_LOGOS[(s as any).logo]).find(Boolean) || LOGO;

  // ── loading / error / closed ──────────────────────────────────────────────────
  if (err && !sections) return <Frame logo={headerLogo} onExit={() => setExitOpen(true)} exitOpen={exitOpen} closeExit={() => setExitOpen(false)}><Center><Big color={RED}>Can't load the menu</Big><P>{err}</P><BigBtn bg={RED} onClick={() => load()}>Try again</BigBtn></Center></Frame>;
  if (!sections || !status) return <Frame logo={headerLogo} onExit={() => setExitOpen(true)} exitOpen={exitOpen} closeExit={() => setExitOpen(false)}><Center><P>Loading the menu…</P></Center></Frame>;
  if (!status.open && phase !== "done") {
    const closed = status.reason === "closed";
    return <Frame logo={headerLogo} onExit={() => setExitOpen(true)} exitOpen={exitOpen} closeExit={() => setExitOpen(false)}><Center>
      <Big color={RED}>{closed ? "Kitchen's closed 🌙" : "Back in a moment"}</Big>
      <P>{closed ? "We're open until 10pm — come back tomorrow and we'll get you sorted." : "We're catching up on a few orders. Please try again in a minute, or order at the hatch."}</P>
    </Center></Frame>;
  }

  return (
    <Frame logo={headerLogo} onExit={() => setExitOpen(true)} exitOpen={exitOpen} closeExit={() => setExitOpen(false)}>
      {picking && <AddonSheet item={picking} onClose={() => setPicking(null)} onAdd={addItem} />}

      {/* ── MENU ── */}
      {phase === "menu" && (
        <Screen>
          <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gridAutoRows: "1fr", gap: 14, overflow: "hidden" }}>
            {tiles.map((t) => {
              if (t.kind === "deal") {
                const soldOut = avail(t.burger) <= 0;
                const price = parseInt(String(t.bn.price_pence), 10) || 0;
                const drink = (t.bn.drink && t.bn.drink.trim()) || "beer";
                return (
                  <Tile key={`deal-${t.bn.id}`} img={t.burger.img} soldOut={soldOut} accent={RED}
                    onTap={() => !soldOut && addDeal(t.bn, t.burger)}
                    badge="🎟 Deal" title={t.bn.name || "Beer + Burger"} sub={`${t.burger.name} + ${drink}`} price={gbp(price)} soldOutLabel={soldOut} />
                );
              }
              const it = t.item;
              const left = avail(it); const soldOut = left <= 0;
              const low = !soldOut && left !== Infinity && left <= 6;
              return (
                <Tile key={it.id} img={it.img} soldOut={soldOut} accent={it.star ? RED : BLUE}
                  onTap={() => !soldOut && (it.addons && it.addons.length ? setPicking(it) : addItem(it, [], 1))}
                  badge={it.star ? "★ Special" : undefined} title={it.name} sub={it.desc} price={gbp(it.sell_pence)}
                  low={low ? left : undefined} hasAddons={!!(it.addons && it.addons.length)} soldOutLabel={soldOut} />
              );
            })}
          </div>
          {tooMany && <div style={{ flex: "none", textAlign: "center", color: MUTED, fontFamily: BODY, fontSize: 12, padding: "4px 0 0" }}>Scroll-free menu is tight at this many items — tap a tile to order.</div>}
          <BottomBar>
            {count > 0 ? (
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setPhase("cart")} style={{ ...bigBtnStyle("transparent", BLUE), border: `3px solid ${BLUE}`, flex: "0 0 38%" }}>Basket · {count}</button>
                <button onClick={() => setPhase("allergy")} style={{ ...bigBtnStyle(RED, "#fff"), flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Checkout</span><span>{gbp(total)}</span>
                </button>
              </div>
            ) : (
              <div style={{ textAlign: "center", fontFamily: DISPLAY, fontSize: 30, color: INK, letterSpacing: "1px" }}>👆 Tap a dish to start your order</div>
            )}
          </BottomBar>
        </Screen>
      )}

      {/* ── CART (review / edit) ── */}
      {phase === "cart" && (
        <Screen>
          <Header title="Your order" onBack={() => setPhase("menu")} />
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {cart.length === 0 ? <P>Basket's empty — tap Add more.</P> : cart.map((l) => (
              <div key={l.uid} style={{ display: "flex", gap: 12, alignItems: "center", borderBottom: `1px solid ${LINE}`, padding: "16px 0" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 19, color: INK }}>{l.item.name}</div>
                  {l.addons.map((a) => <div key={a.id} style={{ fontFamily: BODY, fontSize: 14, color: MUTED }}>+ {a.name} ({gbp(a.price_pence)})</div>)}
                </div>
                <button onClick={() => setQty(l.uid, l.qty - 1)} style={qtyBtn}>−</button>
                <span style={{ fontFamily: DISPLAY, fontSize: 26, minWidth: 26, textAlign: "center" }}>{l.qty}</span>
                <button onClick={() => setQty(l.uid, l.qty + 1)} style={qtyBtn}>+</button>
                <div style={{ fontFamily: DISPLAY, color: RED, fontSize: 24, minWidth: 64, textAlign: "right" }}>{gbp(lineTotal(l))}</div>
              </div>
            ))}
          </div>
          <BottomBar>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <span style={{ fontFamily: DISPLAY, fontSize: 30, color: INK }}>Total</span>
              <span style={{ fontFamily: DISPLAY, fontSize: 38, color: RED }}>{gbp(total)}</span>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setPhase("menu")} style={{ ...bigBtnStyle("transparent", BLUE), border: `3px solid ${BLUE}`, flex: "0 0 40%" }}>Add more</button>
              <button disabled={!cart.length} onClick={() => setPhase("allergy")} style={{ ...bigBtnStyle(cart.length ? RED : LINE, "#fff"), flex: 1 }}>Checkout</button>
            </div>
          </BottomBar>
        </Screen>
      )}

      {/* ── ALLERGY GATE ── */}
      {phase === "allergy" && (() => {
        const declaredAndFlagged = !noAllergies && declared.size > 0;
        const canProceed = noAllergies || declared.size === 0 || accepted;
        return (
          <Screen>
            <Header title="Any allergies?" onBack={() => setPhase("cart")} />
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
              <P>We cook in one small kitchen with a <b>shared fryer and surfaces</b> — we <b>cannot guarantee</b> any dish is free from an allergen, even if it's not listed.</P>
              <button onClick={() => setNoAllergies((v) => { const nv = !v; if (nv) { setDeclared(new Set()); setAccepted(false); } return nv; })}
                style={{ ...chip(noAllergies, GREEN), width: "100%", padding: "20px", fontSize: 22, margin: "6px 0 16px" }}>
                {noAllergies ? "✓ No allergies — I'm good" : "No allergies — I'm good to order"}
              </button>
              <div style={{ fontFamily: BODY, fontSize: 14, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 2px 10px" }}>…or tap what to flag</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {ALLERGENS.map((a) => {
                  const on = declared.has(a.key) && !noAllergies;
                  return (
                    <button key={a.key} disabled={noAllergies}
                      onClick={() => setDeclared((d) => { const n = new Set(d); n.has(a.key) ? n.delete(a.key) : n.add(a.key); return n; })}
                      style={{ ...chip(on, RED), fontSize: 17, padding: "12px 18px", opacity: noAllergies ? 0.4 : 1 }}>
                      {on ? "✓ " : ""}{a.label}
                    </button>
                  );
                })}
              </div>
              {declaredAndFlagged && flagged.length > 0 && (
                <div style={{ border: `2px solid ${RED}`, borderRadius: 14, padding: 16, margin: "16px 0", background: "#fff" }}>
                  <div style={{ fontFamily: DISPLAY, color: RED, fontSize: 24, marginBottom: 8 }}>⚠ Heads up about your order</div>
                  {flagged.map((f) => (
                    <div key={f.name} style={{ fontFamily: BODY, fontSize: 16, lineHeight: 1.45, marginBottom: 6 }}>
                      <b>{f.name}</b>
                      {f.contains.length ? <> contains <b style={{ color: RED }}>{f.contains.join(", ")}</b></> : null}
                      {f.contains.length && f.trace.length ? " and" : null}
                      {f.trace.length ? <> may contain <b style={{ color: "#b8860b" }}>{f.trace.join(", ")}</b></> : null}.
                    </div>
                  ))}
                </div>
              )}
              {declaredAndFlagged && (
                <label style={{ display: "flex", gap: 12, alignItems: "flex-start", fontFamily: BODY, fontSize: 16, lineHeight: 1.4, margin: "16px 2px 0" }}>
                  <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} style={{ marginTop: 3, width: 26, height: 26 }} />
                  <span>I understand and accept the cross-contamination risk. <span style={{ color: MUTED }}>(Severe allergy? Please order at the hatch instead.)</span></span>
                </label>
              )}
            </div>
            <BottomBar>
              <button disabled={!canProceed} onClick={() => setPhase("details")} style={bigBtnStyle(canProceed ? RED : LINE, "#fff")}>
                {noAllergies || declared.size === 0 ? "Continue" : accepted ? "I accept — continue" : "Tick the box to continue"}
              </button>
            </BottomBar>
          </Screen>
        );
      })()}

      {/* ── NAME + PHONE (on-screen numeric keypad) ── */}
      {phase === "details" && (() => {
        const phoneOk = phone.replace(/\D/g, "").length >= 10;
        const ok = name.trim().length >= 2 && phoneOk;
        return (
          <Screen>
            <Header title="Your details" onBack={() => setPhase("allergy")} />
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              <Label>Your name</Label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" autoComplete="off"
                style={{ ...fieldStyle, fontSize: 24, padding: "16px 18px" }} />
              <Label>Mobile — we text you the moment it's ready 📲</Label>
              <div style={{ ...fieldStyle, fontSize: 30, padding: "14px 18px", fontFamily: DISPLAY, letterSpacing: "2px", minHeight: 30, color: phone ? INK : MUTED }}>
                {phone || "07…"}
              </div>
              <Keypad value={phone} onChange={setPhone} />
            </div>
            <BottomBar>
              <button disabled={!ok} onClick={() => setPhase("tip")} style={bigBtnStyle(ok ? RED : LINE, "#fff")}>
                {ok ? "Continue" : name.trim().length < 2 ? "Enter your name" : "Enter your mobile"}
              </button>
            </BottomBar>
          </Screen>
        );
      })()}

      {/* ── TIP ── */}
      {phase === "tip" && (
        <Screen>
          <Header title="Tip the kitchen?" onBack={() => setPhase("details")} />
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
            <P style={{ textAlign: "center", fontSize: 18 }}>100% goes straight to the kitchen team 💛</P>
            {([["10", "10%"], ["5", "5%"], ["none", "No tip"]] as const).map(([k, lbl]) => {
              const on = tipChoice === k;
              const amt = k === "5" ? Math.round(total * 0.05) : k === "10" ? Math.round(total * 0.1) : 0;
              return (
                <button key={k} onClick={() => setTipChoice(k)}
                  style={{ ...chip(on, GREEN), width: "100%", padding: "24px", fontSize: 26, fontFamily: DISPLAY, letterSpacing: "1px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{on ? "✓ " : ""}{lbl}</span>{amt > 0 ? <span>{gbp(amt)}</span> : null}
                </button>
              );
            })}
          </div>
          <BottomBar>
            <button onClick={() => setPhase("pay")} style={bigBtnStyle(RED, "#fff")}>Continue to pay {gbp(grand)}</button>
          </BottomBar>
        </Screen>
      )}

      {/* ── PAY (SumUp Solo — stubbed) ── */}
      {phase === "pay" && (
        <Screen>
          <Header title="Pay" onBack={() => setPhase("tip")} />
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", gap: 10 }}>
            <div style={{ fontFamily: BODY, fontSize: 18, color: MUTED }}>{count} item{count > 1 ? "s" : ""}{tipPence > 0 ? ` + ${gbp(tipPence)} tip` : ""}</div>
            <div style={{ fontFamily: DISPLAY, fontSize: 92, color: RED, lineHeight: 1 }}>{gbp(grand)}</div>
            <div style={{ fontFamily: BODY, fontSize: 20, color: INK, maxWidth: 420, lineHeight: 1.4, marginTop: 8 }}>
              Tap your card or phone on the <b>card reader</b> to pay.
            </div>
            <div style={{ fontFamily: BODY, fontSize: 13, color: MUTED }}>Card payment · contactless, Apple Pay &amp; Google Pay</div>
            {err && <div style={{ fontFamily: BODY, background: "#fff", border: `1px solid ${RED}`, color: RED, borderRadius: 12, padding: "12px 16px", fontSize: 16, marginTop: 8, maxWidth: 440 }}>{err}</div>}
          </div>
          <BottomBar>
            <button disabled={busy} onClick={takePayment} style={bigBtnStyle(busy ? LINE : GREEN, "#fff")}>
              {busy ? "Starting the reader…" : `Take payment · ${gbp(grand)}`}
            </button>
          </BottomBar>
        </Screen>
      )}

      {/* ── DONE ── */}
      {phase === "done" && (
        <Screen>
          <Center>
            <div style={{ fontFamily: DISPLAY, fontSize: 40, color: GREEN, letterSpacing: "1px" }}>✓ Order in!</div>
            <div style={{ fontFamily: BODY, fontSize: 18, color: INK, marginTop: 6 }}>Your order number</div>
            {orderNo != null && <div style={{ fontFamily: DISPLAY, fontSize: 150, color: RED, lineHeight: 1 }}>#{orderNo}</div>}
            <P style={{ textAlign: "center", fontSize: 22, maxWidth: 460 }}>
              Thanks{name.trim() ? " " + name.split(" ")[0] : ""}! <b>We'll text you the second it's ready to collect.</b> Keep an eye on your phone 📲
            </P>
            <button onClick={resetAll} style={{ ...bigBtnStyle(BLUE, "#fff"), maxWidth: 420, marginTop: 10 }}>Done — next order</button>
            <div style={{ fontFamily: BODY, fontSize: 13, color: MUTED, marginTop: 8 }}>This screen resets on its own in a few seconds…</div>
          </Center>
        </Screen>
      )}
    </Frame>
  );
}

// ── on-screen numeric keypad ─────────────────────────────────────────────────────
function Keypad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "0", "⌫"];
  const press = (k: string) => {
    if (k === "⌫") return onChange(value.slice(0, -1));
    if (k === "+") return onChange(value.includes("+") || value.length ? value : "+");
    if (value.replace(/\D/g, "").length >= 15) return;
    onChange(value + k);
  };
  return (
    <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridAutoRows: "1fr", gap: 10, marginTop: 4 }}>
      {keys.map((k) => (
        <button key={k} onClick={() => press(k)}
          style={{ border: `2px solid ${LINE}`, background: "#fff", borderRadius: 14, fontFamily: DISPLAY, fontSize: 34, color: k === "⌫" ? RED : INK, cursor: "pointer", touchAction: "manipulation" }}>
          {k}
        </button>
      ))}
    </div>
  );
}

// ── add-on quick sheet ───────────────────────────────────────────────────────────
function AddonSheet({ item, onClose, onAdd }: { item: Item; onClose: () => void; onAdd: (i: Item, a: Addon[], q: number) => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState(1);
  const addons = item.addons || [];
  const chosen = addons.filter((a) => sel.has(a.id));
  const unit = item.sell_pence + chosen.reduce((s, a) => s + a.price_pence, 0);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(21,48,92,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: CREAM, width: "100%", maxWidth: 700, borderRadius: "22px 22px 0 0", padding: "24px 22px 26px", maxHeight: "80%", overflowY: "auto" }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 36, color: INK, letterSpacing: "0.5px" }}>{item.name}</div>
        {item.desc && <div style={{ fontFamily: BODY, fontSize: 15, color: MUTED, margin: "4px 0 14px" }}>{item.desc}</div>}
        <div style={{ fontFamily: BODY, fontSize: 14, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Add extras</div>
        {addons.map((a) => {
          const on = sel.has(a.id);
          return (
            <button key={a.id} onClick={() => setSel((s) => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })}
              style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "18px 18px", borderRadius: 12, marginBottom: 10, cursor: "pointer",
                border: `3px solid ${on ? RED : LINE}`, background: on ? "#fff" : "transparent", fontFamily: BODY, fontSize: 19, fontWeight: 700, color: INK }}>
              <span>{on ? "✓ " : ""}{a.name}</span><span style={{ color: RED }}>+{gbp(a.price_pence)}</span>
            </button>
          );
        })}
        <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "16px 0" }}>
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={qtyBtn}>−</button>
          <span style={{ fontFamily: DISPLAY, fontSize: 32, minWidth: 30, textAlign: "center" }}>{qty}</span>
          <button onClick={() => setQty((q) => q + 1)} style={qtyBtn}>+</button>
        </div>
        <button onClick={() => onAdd(item, chosen, qty)} style={bigBtnStyle(RED, "#fff")}>Add {qty} · {gbp(unit * qty)}</button>
      </div>
    </div>
  );
}

// ── menu tile ─────────────────────────────────────────────────────────────────────
// Works with OR without a photo: an image fills a top band when present, otherwise
// the text is centred on a soft accent-tinted card so the tile never looks empty.
function Tile({ img, title, sub, price, badge, low, hasAddons, soldOut, soldOutLabel, accent, onTap }: {
  img?: string; title: string; sub?: string; price: string; badge?: string; low?: number; hasAddons?: boolean;
  soldOut?: boolean; soldOutLabel?: boolean; accent: string; onTap: () => void;
}) {
  const tint = accent === RED ? "rgba(224,35,27,0.06)" : "rgba(24,63,160,0.05)";
  return (
    <button onClick={onTap} disabled={soldOut}
      style={{ position: "relative", display: "flex", flexDirection: "column", textAlign: img ? "left" : "center", overflow: "hidden",
        border: `3px solid ${soldOut ? LINE : accent}`, borderRadius: 18, background: img ? "#fff" : tint, padding: 0, cursor: soldOut ? "default" : "pointer",
        opacity: soldOut ? 0.55 : 1, touchAction: "manipulation", minHeight: 0 }}>
      {img && <img src={img} alt="" style={{ flex: 1, minHeight: 0, width: "100%", objectFit: "cover", filter: soldOut ? "grayscale(1)" : "none" }} />}
      <div style={{ padding: img ? "10px 14px 12px" : "16px 16px 54px", flex: img ? "none" : 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
        {badge && <div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>{badge}</div>}
        <div style={{ fontFamily: DISPLAY, fontSize: 30, color: INK, lineHeight: 1.05, letterSpacing: "0.5px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as any }}>{title}</div>
        {sub && <div style={{ fontFamily: BODY, fontSize: 13.5, color: MUTED, lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{sub}</div>}
        <div style={{ fontFamily: DISPLAY, fontSize: 30, color: RED, lineHeight: 1, marginTop: 2 }}>{price}</div>
      </div>
      {soldOutLabel && <div style={{ position: "absolute", top: 12, left: 12, background: "#efe6cf", color: "#8a7f63", fontFamily: DISPLAY, fontSize: 18, padding: "4px 12px", borderRadius: 10, letterSpacing: "0.5px" }}>Sold out</div>}
      {!soldOut && typeof low === "number" && <div style={{ position: "absolute", top: 12, left: 12, background: RED, color: "#fff", fontFamily: BODY, fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 999 }}>Only {low} left</div>}
      {!soldOut && <div style={{ position: "absolute", bottom: 12, right: 12, width: 48, height: 48, borderRadius: 999, background: accent, color: "#fff", fontFamily: DISPLAY, fontSize: 32, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }} aria-label={hasAddons ? "Choose extras" : "Add"}>+</div>}
    </button>
  );
}

// ── frame + kiosk chrome ────────────────────────────────────────────────────────
function Frame({ children, logo, onExit, exitOpen, closeExit }: { children: React.ReactNode; logo: string; onExit: () => void; exitOpen: boolean; closeExit: () => void }) {
  const timer = useRef<number | null>(null);
  const startHold = () => { timer.current = window.setTimeout(onExit, 1600); };
  const cancelHold = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  return (
    <div style={{ position: "fixed", inset: 0, background: CREAM, color: INK, fontFamily: BODY, userSelect: "none", WebkitUserSelect: "none", touchAction: "manipulation", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: "none", background: CREAM, padding: "14px 18px", textAlign: "center", borderBottom: `4px solid ${BLUE}`, position: "relative" }}>
        {/* discreet staff exit — long-press this corner */}
        <div onPointerDown={startHold} onPointerUp={cancelHold} onPointerLeave={cancelHold}
          style={{ position: "absolute", top: 0, left: 0, width: 72, height: 72, zIndex: 5 }} aria-hidden />
        <img src={logo} alt="On A Roll" style={{ height: 64, maxWidth: "70%", objectFit: "contain" }} draggable={false} />
      </div>
      <div style={{ flex: 1, minHeight: 0, width: "100%", maxWidth: 820, margin: "0 auto", padding: "16px 18px 18px", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
      {exitOpen && <ExitPad onClose={closeExit} />}
    </div>
  );
}

function ExitPad({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState("");
  const [bad, setBad] = useState(false);
  const submit = (c: string) => {
    if (c.length < 4) return;
    if (c === STAFF_EXIT_CODE) { window.location.href = "/onaroll"; return; }
    setBad(true); setCode("");
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(21,48,92,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: CREAM, borderRadius: 20, padding: 24, width: 320, textAlign: "center" }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 26, color: INK, letterSpacing: "0.5px" }}>Staff code</div>
        <div style={{ fontFamily: DISPLAY, fontSize: 38, letterSpacing: "8px", color: bad ? RED : INK, margin: "10px 0 14px", minHeight: 40 }}>{code.replace(/./g, "•") || "— — — —"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "✕", "0", "⌫"].map((k) => (
            <button key={k} onClick={() => {
              if (k === "✕") return onClose();
              if (k === "⌫") return setCode((c) => c.slice(0, -1));
              const nc = (code + k).slice(0, 4); setCode(nc); setBad(false); if (nc.length === 4) setTimeout(() => submit(nc), 120);
            }} style={{ border: `2px solid ${LINE}`, background: "#fff", borderRadius: 12, padding: "16px 0", fontFamily: DISPLAY, fontSize: 26, color: k === "✕" ? MUTED : k === "⌫" ? RED : INK, cursor: "pointer" }}>{k}</button>
          ))}
        </div>
        {bad && <div style={{ fontFamily: BODY, color: RED, fontSize: 14, marginTop: 10 }}>Wrong code</div>}
      </div>
    </div>
  );
}

// ── little pieces ─────────────────────────────────────────────────────────────────
const Screen = ({ children }: { children: React.ReactNode }) => <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{children}</div>;
const BottomBar = ({ children }: { children: React.ReactNode }) => <div style={{ flex: "none", paddingTop: 14 }}>{children}</div>;
const Header = ({ title, onBack }: { title: string; onBack: () => void }) => (
  <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
    <button onClick={onBack} style={{ flex: "none", width: 52, height: 52, borderRadius: 14, border: `2px solid ${BLUE}`, background: "#fff", color: BLUE, fontSize: 24, cursor: "pointer" }}>←</button>
    <h1 style={{ fontFamily: DISPLAY, fontSize: 40, color: INK, margin: 0, letterSpacing: "0.5px" }}>{title}</h1>
  </div>
);
const Center = ({ children }: { children: React.ReactNode }) => <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 6 }}>{children}</div>;
const Big = ({ children, color = INK }: { children: React.ReactNode; color?: string }) => <div style={{ fontFamily: DISPLAY, fontSize: 48, color, letterSpacing: "1px" }}>{children}</div>;
const P = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => <p style={{ fontFamily: BODY, fontSize: 16, lineHeight: 1.5, color: INK, margin: "8px 0", maxWidth: 560, ...style }}>{children}</p>;
const Label = ({ children }: { children: React.ReactNode }) => <div style={{ flex: "none", fontFamily: BODY, fontSize: 14, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>{children}</div>;

function bigBtnStyle(bg: string, color: string): React.CSSProperties {
  return { width: "100%", border: "none", borderRadius: 16, padding: "22px", fontFamily: DISPLAY, fontSize: 28, letterSpacing: "1px", textTransform: "uppercase", cursor: "pointer", background: bg, color, touchAction: "manipulation" };
}
const BigBtn = ({ children, bg, onClick }: { children: React.ReactNode; bg: string; onClick: () => void }) => <button onClick={onClick} style={{ ...bigBtnStyle(bg, "#fff"), maxWidth: 420 }}>{children}</button>;
const chip = (on: boolean, accent: string): React.CSSProperties => ({ fontFamily: BODY, fontWeight: 700, borderRadius: 14, cursor: "pointer", border: `3px solid ${on ? accent : LINE}`, background: on ? "#fff" : "transparent", color: on ? accent : INK, touchAction: "manipulation" });
const qtyBtn: React.CSSProperties = { flex: "none", width: 48, height: 48, borderRadius: 999, border: `3px solid ${BLUE}`, background: "#fff", color: BLUE, fontSize: 28, fontWeight: 800, cursor: "pointer", lineHeight: 1, touchAction: "manipulation" };
const fieldStyle: React.CSSProperties = { flex: "none", width: "100%", borderRadius: 14, border: `2px solid ${LINE}`, background: "#fff", color: INK, fontFamily: BODY, boxSizing: "border-box", outline: "none" };
