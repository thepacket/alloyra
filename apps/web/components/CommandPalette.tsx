"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { alloys, microConcepts } from "@alloyra/data";
import { MECHANISMS, type MechanismId } from "@alloyra/core";

interface Cmd {
  id: string;
  label: string;
  kind: string;
  keywords: string;
  run: (router: ReturnType<typeof useRouter>) => void;
}

const navCmds: Cmd[] = [
  { id: "nav-db", label: "Go to Alloy database", kind: "nav", keywords: "database alloys", run: (r) => r.push("/database") },
  { id: "nav-screening", label: "Go to Staged screening", kind: "nav", keywords: "screening stages filter funnel report", run: (r) => r.push("/screening") },
  { id: "nav-profiles", label: "Go to Duty profiles", kind: "nav", keywords: "duty profile environment", run: (r) => r.push("/profiles") },
  { id: "nav-comparisons", label: "Go to Comparisons", kind: "nav", keywords: "compare ranking", run: (r) => r.push("/comparisons") },
  { id: "nav-rules", label: "Go to Failure rules", kind: "nav", keywords: "scc failure rules", run: (r) => r.push("/rules") },
  { id: "nav-studio", label: "Go to Composition studio", kind: "nav", keywords: "composition studio calculators", run: (r) => r.push("/studio") },
];

const alloyCmds: Cmd[] = alloys.map((a) => {
  const mechs = a.conditions
    .flatMap((c) => c.microstructure?.strengthening ?? [])
    .map((t) => MECHANISMS[t.mechanism].label)
    .join(" ");
  return {
    id: `alloy-${a.uns}`,
    label: `${a.names[0]} · ${a.uns}`,
    kind: a.family.slice(0, 2).join(" / "),
    keywords: `${a.uns} ${a.names.join(" ")} ${a.family.join(" ")} ${mechs}`.toLowerCase(),
    run: (r) => r.push(`/database?sel=${a.uns}`),
  };
});

// Microstructure hunting terms (E1): mechanisms and concept vocabulary are
// first-class palette targets — "precipitation hardening" must land somewhere.
const mechCmds: Cmd[] = (Object.keys(MECHANISMS) as MechanismId[]).map((m) => ({
  id: `mech-${m}`,
  label: `Filter database: ${MECHANISMS[m].label.toLowerCase()} strengthening`,
  kind: "mechanism",
  keywords: `${MECHANISMS[m].label} ${MECHANISMS[m].synonyms.join(" ")}`.toLowerCase(),
  run: (r) => r.push(`/database?mech=${m}`),
}));

const conceptCmds: Cmd[] = microConcepts.map((c) => ({
  id: `concept-${c.id}`,
  label: `Microstructure: ${c.name}`,
  kind: "concept",
  keywords: `${c.name} ${c.synonyms.join(" ")}`.toLowerCase(),
  run: (r) => r.push(`/database?q=${encodeURIComponent(c.probe)}`),
}));

const allCmds = [...alloyCmds, ...conceptCmds, ...mechCmds, ...navCmds];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCmds.slice(0, 12);
    return allCmds
      .filter((c) => c.keywords.includes(q) || c.label.toLowerCase().includes(q))
      .slice(0, 12);
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHi(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => setHi(0), [results]);

  const pick = (cmd: Cmd | undefined) => {
    if (!cmd) return;
    cmd.run(router);
    close();
  };

  return (
    <>
      <button
        type="button"
        className="cmdk-hint"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
      >
        <span>Search alloys, actions…</span>
        <kbd>⌘K</kbd>
      </button>
      {open && (
        <div className="palette-overlay" onMouseDown={close}>
          <div
            className="palette"
            role="dialog"
            aria-label="Command palette"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* ARIA combobox/listbox pattern: keyboard behavior unchanged,
                but a screen reader now hears the results and the current
                selection. */}
            <input
              ref={inputRef}
              value={query}
              placeholder="Type an alloy, UNS number, or action…"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="cmdk-listbox"
              aria-activedescendant={results[hi] ? `cmdk-opt-${results[hi].id}` : undefined}
              aria-autocomplete="list"
              aria-label="Search alloys, microstructure concepts, and actions"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHi((h) => Math.min(h + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHi((h) => Math.max(h - 1, 0));
                } else if (e.key === "Enter") {
                  pick(results[hi]);
                }
              }}
            />
            <div className="results" role="listbox" id="cmdk-listbox" aria-label="Search results">
              {results.length === 0 && (
                <div className="empty" role="status">No matches in dataset or actions.</div>
              )}
              {results.map((c, i) => (
                <div
                  key={c.id}
                  id={`cmdk-opt-${c.id}`}
                  role="option"
                  aria-selected={i === hi}
                  className={`item ${i === hi ? "hi" : ""}`}
                  onMouseEnter={() => setHi(i)}
                  onClick={() => pick(c)}
                >
                  <span>{c.label}</span>
                  <span className="kind">{c.kind}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
