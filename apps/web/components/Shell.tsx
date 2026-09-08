"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DATASET_VERSION } from "@alloyra/data";
import Link from "next/link";
import { activeStudy, readWorkspace, reloadWorkspace, matchesCurrentData, continueWithCurrentData, createStudy, requiresCurrentStudy, STUDY_SWITCHED, STUDY_CHANGED, STORAGE_ERROR } from "../lib/workspace";
import { StudyBar } from "./StudyBar";
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
  const [activeId, setActiveId] = useState("");
  const [externalRevision, setExternalRevision] = useState(0);
  const [archival, setArchival] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const refresh = () => { try { setActiveId(readWorkspace().activeId); const s = activeStudy(); setArchival(!!s && !matchesCurrentData(s)); } catch (e) { setStorageError(String(e)); } };
    const crossTab = (e: StorageEvent) => { if (e.key === "alloyra.workspace.v1") { reloadWorkspace(); refresh(); setExternalRevision((v) => v + 1); window.dispatchEvent(new Event(STUDY_CHANGED)); } };
    const error = () => setStorageError("Browser storage could not save the latest change. Export your saved study to keep a recovery copy; recent unsaved edits remain in this pane.");
    refresh(); try { setCollapsed(localStorage.getItem("alloyra.rail-collapsed") === "true"); } catch { /* optional UI preference */ }
    window.addEventListener(STUDY_SWITCHED, refresh); window.addEventListener("storage", crossTab); window.addEventListener(STORAGE_ERROR, error);
    return () => { window.removeEventListener(STUDY_SWITCHED, refresh); window.removeEventListener("storage", crossTab); window.removeEventListener(STORAGE_ERROR, error); };
  }, []);

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
    <div className={`shell ${collapsed ? "rail-collapsed" : ""}`}>
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
        <span className="preview-chip" title="Alloyra = alloy Research Assistant. Screening and hypothesis generation only — never qualification, code compliance, or design approval. See the home page for the release boundary.">
          RESEARCH ASSISTANT
        </span>
        <button className="btn ghost rail-toggle" aria-pressed={collapsed} onClick={() => { setCollapsed(!collapsed); try { localStorage.setItem("alloyra.rail-collapsed", String(!collapsed)); } catch { /* optional */ } }}>{collapsed ? "Show navigation" : "Hide navigation"}</button>
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
      <div className="work-area"><StudyBar />{storageError && <p className="storage-error" role="alert">{storageError}<button className="btn ghost" onClick={() => setStorageError("")}>Dismiss</button></p>}<main className="main" key={`${activeId}:${externalRevision}`}>{archival && requiresCurrentStudy(pathname) ? <div className="studies-content"><h1>Continue with updated reference data</h1><p>This study was saved with an earlier or different dataset. Create a working copy to continue with the current references. Your duty, shortlist, measurements and settings will be copied; prior results, verification notes and decisions stay in the original study.</p><p>Recompute and review the working copy before recording a new decision.</p><div className="study-actions"><button className="btn" onClick={() => { try { continueWithCurrentData(); setStorageError(""); } catch (e) { setStorageError(e instanceof Error ? e.message : String(e)); } }}>Continue in an updated copy</button><button className="btn ghost" onClick={() => { try { createStudy(); setStorageError(""); } catch (e) { setStorageError(String(e)); } }}>Start a blank study</button><Link href="/studies" className="btn ghost">Review original study</Link></div></div> : activeId ? children : null}</main></div>
    </div>
  );
}
