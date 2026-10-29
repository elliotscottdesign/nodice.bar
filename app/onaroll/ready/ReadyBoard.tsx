"use client";

import { useEffect, useRef, useState } from "react";
import { SUPABASE_URL } from "@/lib/stripe";

// On A Roll — in-venue "NOW SERVING" board. RED on BLACK, landscape, for a locked
// iPad mounted in the bar so customers with no signal can see when their order is
// up. Polls the (public) food-order `readyBoard` action every few seconds and
// shows each READY order's number + first name, newest one highlighted. Drops off
// when the kitchen marks it collected. No sensitive data is shown or fetched.

const RED = "#ff3b2f", DIM = "#7a1610", BLACK = "#000000", CREAM = "#f6ecd6", MUTED = "#5a4b45";
const DISPLAY = "'Bebas Neue', Impact, 'Arial Narrow Bold', sans-serif";
const BODY = "'Inter', system-ui, -apple-system, sans-serif";
const LOGO = "/onaroll-logo.png";

type Row = { order_no: number; name: string; ready_at: string };

const BOARD_CSS = `
html,body{background:#000;margin:0;}
@keyframes ndPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,59,47,0.55);}50%{box-shadow:0 0 44px 6px rgba(255,59,47,0.55);}}
@keyframes ndBlink{0%,100%{opacity:1;}50%{opacity:0.35;}}
`;

export default function ReadyBoard() {
  const [orders, setOrders] = useState<Row[] | null>(null);
  const [offline, setOffline] = useState(false);
  const prevTop = useRef<number | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/food-order`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "readyBoard" }),
      });
      const d = await res.json();
      setOrders(Array.isArray(d.orders) ? d.orders : []);
      setOffline(false);
    } catch { setOffline(true); }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  // Kiosk lock: no context menu / no text select / no zoom.
  useEffect(() => {
    const noop = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", noop);
    document.addEventListener("gesturestart", noop as any, { passive: false } as any);
    return () => { document.removeEventListener("contextmenu", noop); document.removeEventListener("gesturestart", noop as any); };
  }, []);

  const list = orders || [];
  const newestNo = list.length ? list[0].order_no : null;
  // Track whether the top order just changed (for the "just up" emphasis).
  useEffect(() => { if (newestNo != null) prevTop.current = newestNo; }, [newestNo]);

  const shell: React.CSSProperties = {
    position: "fixed", inset: 0, background: BLACK, color: RED, fontFamily: BODY,
    userSelect: "none", WebkitUserSelect: "none", touchAction: "manipulation",
    display: "flex", flexDirection: "column", overflow: "hidden",
    padding: "calc(16px + env(safe-area-inset-top)) calc(24px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) calc(24px + env(safe-area-inset-left))",
  };

  return (
    <div style={shell}>
      <style dangerouslySetInnerHTML={{ __html: BOARD_CSS }} />
      {/* header */}
      <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `3px solid ${DIM}`, paddingBottom: 12, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src={LOGO} alt="On A Roll" style={{ height: 46, filter: "brightness(0) saturate(100%) invert(36%) sepia(89%) saturate(5000%) hue-rotate(354deg)" }} draggable={false} />
          <div style={{ fontFamily: DISPLAY, fontSize: "clamp(34px,6vh,60px)", letterSpacing: "2px", color: RED, lineHeight: 1 }}>Orders ready</div>
        </div>
        <div style={{ fontFamily: BODY, fontSize: "clamp(13px,2.2vh,20px)", color: CREAM, opacity: 0.8, textAlign: "right", lineHeight: 1.3 }}>
          Collect from the van<br />when your number shows
        </div>
      </div>

      {/* body */}
      {orders === null ? (
        <Center><span style={{ fontFamily: DISPLAY, fontSize: "clamp(30px,6vh,56px)", color: DIM }}>Loading…</span></Center>
      ) : list.length === 0 ? (
        <Center>
          <div style={{ fontFamily: DISPLAY, fontSize: "clamp(48px,13vh,130px)", color: RED, lineHeight: 1, letterSpacing: "2px" }}>No orders up yet</div>
          <div style={{ fontFamily: BODY, fontSize: "clamp(16px,3vh,28px)", color: CREAM, opacity: 0.75, marginTop: 14 }}>Your number will appear here the moment your food's ready 🍔</div>
        </Center>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(clamp(220px, 26vw, 360px), 1fr))`, gridAutoRows: "min-content", alignContent: "center", justifyContent: "center", gap: "clamp(14px,2.4vh,26px)", overflow: "hidden" }}>
          {list.map((o) => {
            const newest = o.order_no === newestNo;
            return (
              <div key={o.order_no} style={{
                border: `3px solid ${newest ? RED : DIM}`, borderRadius: 20, padding: "clamp(14px,2.6vh,30px) 18px", textAlign: "center",
                background: newest ? "rgba(255,59,47,0.07)" : "transparent",
                animation: newest ? "ndPulse 1.8s ease-in-out infinite" : undefined,
              }}>
                {newest && <div style={{ fontFamily: BODY, fontSize: "clamp(12px,1.8vh,18px)", fontWeight: 800, letterSpacing: "0.12em", color: RED, textTransform: "uppercase", animation: "ndBlink 1.4s step-start infinite", marginBottom: 4 }}>● Now calling</div>}
                <div style={{ fontFamily: DISPLAY, fontSize: "clamp(72px,16vh,190px)", color: RED, lineHeight: 0.92, letterSpacing: "1px" }}>#{o.order_no}</div>
                <div style={{ fontFamily: DISPLAY, fontSize: "clamp(26px,5vh,62px)", color: CREAM, lineHeight: 1, letterSpacing: "1px", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name || " "}</div>
              </div>
            );
          })}
        </div>
      )}

      {offline && <div style={{ flex: "none", textAlign: "center", color: MUTED, fontFamily: BODY, fontSize: 13, paddingTop: 8 }}>Reconnecting…</div>}
    </div>
  );
}

const Center = ({ children }: { children: React.ReactNode }) => (
  <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>{children}</div>
);
