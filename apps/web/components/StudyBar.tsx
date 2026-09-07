"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { loadStored, saveComparison, STUDY_CHANGED } from "../lib/comparison";
import { loadProfiles } from "../lib/profiles";

export function StudyBar() {
  const pathname = usePathname();
  const [name, setName] = useState("Untitled study");
  const [duty, setDuty] = useState("");
  const [count, setCount] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => {
    const refresh = () => {
      const study = loadStored();
      setName(study.studyName);
      setCount(study.slots.filter((s) => !s.excluded).length);
      setDuty(loadProfiles().find((p) => p.id === study.profileId)?.name ?? "");
    };
    refresh();
    window.addEventListener(STUDY_CHANGED, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(STUDY_CHANGED, refresh); window.removeEventListener("storage", refresh); };
  }, [pathname]);
  const saveName = () => {
    const studyName = name.trim() || "Untitled study";
    setName(studyName);
    setError(!saveComparison({ ...loadStored(), studyName }));
  };
  const next = !duty ? { href: "/profiles?from=screening", label: "Define duty" }
    : count === 0 ? { href: "/screening", label: "Screen candidates" }
    : pathname.startsWith("/comparisons") ? { href: "/comparisons#failure-audit", label: "Inspect risks" }
    : { href: "/comparisons", label: "Compare shortlist" };
  return <section className="study-bar" aria-label="Active study">
    <label>Study <input aria-label="Study name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} /></label>
    <span className="study-duty" title={duty}>Duty: {duty || "not selected"}</span>
    <span>{count} candidates</span>
    <Link className="btn ghost" href="/studies">Saved studies</Link>
    <Link className="btn ghost" href={next.href}>Next: {next.label} →</Link>
    {error && <span role="alert">Could not save study name.</span>}
  </section>;
}
