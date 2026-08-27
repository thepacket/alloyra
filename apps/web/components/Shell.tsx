"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DATASET_VERSION } from "@alloyra/data";
import { Rail } from "./Rail";
import { CommandPalette } from "./CommandPalette";

/**
 * Workbench chrome. Desktop: fixed titlebar + rail (U-1). Below 768 px the
 * rail becomes a drawer behind a menu button — the workbench is
 * desktop-first (U-6) but must remain navigable on a phone.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Route change (drawer navigation) closes the drawer.
  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="shell">
      <header className="titlebar">
        <button
          type="button"
          className="menu-btn"
          aria-label={drawerOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen((v) => !v)}
        >
          <span aria-hidden>≡</span>
        </button>
        <span className="wordmark">
          Alloy<b>ra</b>
        </span>
        <CommandPalette />
        <span className="spacer" />
        <span className="sys-chip">
          DATA <b>{DATASET_VERSION}</b>
        </span>
        <span className="sys-chip">
          UNITS <b>SI</b>
        </span>
      </header>
      <div className={`rail-holder ${drawerOpen ? "open" : ""}`}>
        <Rail />
      </div>
      {drawerOpen && (
        <div
          className="drawer-backdrop"
          aria-hidden
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <main className="main">{children}</main>
    </div>
  );
}
