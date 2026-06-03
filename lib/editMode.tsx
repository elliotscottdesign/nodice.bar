"use client";

// =============================================================
// Plonk Golf — edit mode context
// =============================================================
// A tiny global toggle that flips the public site into in-place
// edit mode. Wraps the public layout; the AdminBar toggles it,
// and individual <Editable> wrappers read it to decide whether to
// turn themselves into contenteditable elements.
//
// Persistence: sessionStorage so a refresh keeps the same state
// for the rest of the browser session, but closing the tab resets
// it back to "view as visitor".
// =============================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type EditModeContextValue = {
  editing: boolean;
  setEditing: (v: boolean) => void;
  toggle: () => void;
};

const Ctx = createContext<EditModeContextValue>({
  editing: false,
  setEditing: () => {},
  toggle: () => {},
});

const STORAGE_KEY = "pg_edit_mode";

export function EditModeProvider({ children }: { children: React.ReactNode }) {
  const [editing, setEditingState] = useState(false);

  // Hydrate from sessionStorage. We also honour ?edit=1 as a
  // shortcut — handy when the admin clicks "Edit this page" from
  // the admin bar.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY) === "1";
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get("edit") === "1";
      if (stored || fromQuery) setEditingState(true);
    } catch {
      /* sessionStorage might be blocked */
    }
  }, []);

  const setEditing = useCallback((v: boolean) => {
    setEditingState(v);
    try {
      if (v) sessionStorage.setItem(STORAGE_KEY, "1");
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);
  const toggle = useCallback(() => setEditing(!editing), [editing, setEditing]);

  return (
    <Ctx.Provider value={{ editing, setEditing, toggle }}>
      {children}
    </Ctx.Provider>
  );
}

export function useEditMode(): boolean {
  return useContext(Ctx).editing;
}

export function useEditModeControls(): EditModeContextValue {
  return useContext(Ctx);
}
