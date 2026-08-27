"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  blankProfile as blank,
  loadProfiles as load,
  saveProfiles,
  validateProfile,
  type DutyProfile,
} from "../lib/profiles";

/** Yes / No / Unknown select — unknown is a legitimate, first-class answer. */
function TriSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: "yes" | "no" | "unknown";
  onChange: (v: "yes" | "no" | "unknown") => void;
}) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as "yes" | "no" | "unknown")}>
      <option value="unknown">Unknown</option>
      <option value="no">No</option>
      <option value="yes">Yes</option>
    </select>
  );
}

function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function ProfilesView() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get("from") === "comparisons" ? "/comparisons" : null;
  const [profiles, setProfiles] = useState<DutyProfile[]>([]);
  const [draft, setDraft] = useState<DutyProfile>(blank());
  const [loaded, setLoaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProfiles(load());
    setLoaded(true);
  }, []);

  const exportProfiles = () => {
    const blob = new Blob([JSON.stringify(profiles, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alloyra-duty-profiles-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importProfiles = (file: File) => {
    file.text().then((text) => {
      try {
        const incoming = JSON.parse(text) as DutyProfile[];
        if (!Array.isArray(incoming)) return;
        const byId = new Map(profiles.map((p) => [p.id, p]));
        for (const p of incoming) if (p?.id && p?.name) byId.set(p.id, p);
        persist([...byId.values()]);
      } catch {
        /* leave state unchanged on a bad file */
      }
    });
  };

  const persist = (next: DutyProfile[]) => {
    setProfiles(next);
    saveProfiles(next);
  };

  const errors = validateProfile(draft);

  const save = () => {
    if (!draft.name.trim() || errors.length > 0) return;
    const existing = profiles.find((p) => p.id === draft.id);
    const record: DutyProfile = {
      ...draft,
      version: existing ? existing.version + 1 : 1,
      savedAt: new Date().toISOString(),
    };
    persist([record, ...profiles.filter((p) => p.id !== draft.id)]);
    setDraft(record);
    if (returnTo) router.push(returnTo);
  };

  const set = <K extends keyof DutyProfile>(key: K, value: DutyProfile[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <>
      <div className="pane-header">
        <h1>Duty profiles</h1>
        <span className="count">{loaded ? `${profiles.length} saved` : ""}</span>
        <span style={{ flex: 1 }} />
        {returnTo && (
          <span className="save-hint">Saving returns you to the comparison</span>
        )}
        {!draft.name.trim() && (
          <span className="save-hint" id="save-hint">
            Name the profile to enable Save
          </span>
        )}
        <button type="button" className="btn ghost" onClick={exportProfiles} disabled={profiles.length === 0}>
          Export
        </button>
        <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
          Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importProfiles(f);
            e.target.value = "";
          }}
        />
        <button type="button" className="btn ghost" onClick={() => setDraft(blank())}>
          New profile
        </button>
        <button
          type="button"
          className="btn"
          onClick={save}
          disabled={!draft.name.trim() || errors.length > 0}
          aria-describedby={!draft.name.trim() ? "save-hint" : undefined}
        >
          Save {profiles.some((p) => p.id === draft.id) ? `(v${draft.version + 1})` : ""}
        </button>
      </div>
      {errors.length > 0 && (
        <div className="profile-errors" role="alert">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}
      <div className="split">
        <div className="side-list" aria-label="Saved profiles">
          <div className="storage-note">
            Profiles are saved in this browser only — use Export to back up
            or move them. Fields left Unknown make the affected rules report
            "insufficient information" instead of silently passing.
          </div>
          {loaded && profiles.length === 0 && (
            <div className="item" style={{ cursor: "default" }}>
              No profiles yet — capture the duty on the right.
            </div>
          )}
          {profiles.map((p) => (
            <div
              key={p.id}
              className={`item ${p.id === draft.id ? "on" : ""}`}
              onClick={() => setDraft(p)}
            >
              <div>{p.name}</div>
              <div className="sub">
                v{p.version} · {p.savedAt.slice(0, 10)}
              </div>
            </div>
          ))}
        </div>
        <div className="form-scroll">
          <fieldset>
            <legend>Identity</legend>
            <div className="frow">
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="dp-name">Profile name</label>
                <input
                  id="dp-name"
                  value={draft.name}
                  placeholder="e.g. Seawater intake fastener, splash zone"
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>Thermal duty — R-1.1</legend>
            <div className="frow">
              <div className="field">
                <label htmlFor="t-min">Min service temp (°C)</label>
                <input id="t-min" inputMode="decimal" value={draft.thermal.minC ?? ""}
                  onChange={(e) => set("thermal", { ...draft.thermal, minC: num(e.target.value) })} />
              </div>
              <div className="field">
                <label htmlFor="t-nom">Nominal (°C)</label>
                <input id="t-nom" inputMode="decimal" value={draft.thermal.nomC ?? ""}
                  onChange={(e) => set("thermal", { ...draft.thermal, nomC: num(e.target.value) })} />
              </div>
              <div className="field">
                <label htmlFor="t-max">Max / excursion (°C)</label>
                <input id="t-max" inputMode="decimal" value={draft.thermal.maxC ?? ""}
                  onChange={(e) => set("thermal", { ...draft.thermal, maxC: num(e.target.value) })} />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>Mechanical duty — R-1.2</legend>
            <div className="frow">
              <div className="field">
                <label htmlFor="m-load">Load type</label>
                <select id="m-load" value={draft.mechanical.loadType}
                  onChange={(e) => set("mechanical", { ...draft.mechanical, loadType: e.target.value as DutyProfile["mechanical"]["loadType"] })}>
                  <option value="unknown">Unknown</option>
                  <option value="static">Static</option>
                  <option value="cyclic">Cyclic (fatigue)</option>
                  <option value="impact">Impact</option>
                  <option value="sustained">Sustained (creep/SCC relevant)</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="m-stress">Design stress (MPa)</label>
                <input id="m-stress" inputMode="decimal" value={draft.mechanical.designStressMPa ?? ""}
                  onChange={(e) => set("mechanical", { ...draft.mechanical, designStressMPa: num(e.target.value) })} />
              </div>
              <div className="field">
                <label htmlFor="m-r">R-ratio</label>
                <input id="m-r" inputMode="decimal" value={draft.mechanical.rRatio ?? ""}
                  onChange={(e) => set("mechanical", { ...draft.mechanical, rRatio: num(e.target.value) })} />
              </div>
              <div className="field">
                <label htmlFor="m-n">Target cycles</label>
                <input id="m-n" inputMode="numeric" value={draft.mechanical.cycles ?? ""}
                  onChange={(e) => set("mechanical", { ...draft.mechanical, cycles: num(e.target.value) })} />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>Environment chemistry — R-1.3</legend>
            <div className="frow">
              <div className="field">
                <label htmlFor="c-med">Medium</label>
                <select id="c-med" value={draft.chemistry.medium}
                  onChange={(e) => set("chemistry", { ...draft.chemistry, medium: e.target.value as DutyProfile["chemistry"]["medium"] })}>
                  <option value="unknown">Unknown</option>
                  <option value="atmospheric">Atmospheric</option>
                  <option value="immersion">Immersion</option>
                  <option value="soil">Soil / buried</option>
                  <option value="process-fluid">Process fluid</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="c-cl">Chloride (ppm)</label>
                <input id="c-cl" inputMode="decimal" value={draft.chemistry.chloridePpm ?? ""}
                  onChange={(e) => set("chemistry", { ...draft.chemistry, chloridePpm: num(e.target.value) })} />
              </div>
              <div className="field">
                <label htmlFor="c-ph">pH</label>
                <input id="c-ph" inputMode="decimal" value={draft.chemistry.pH ?? ""}
                  onChange={(e) => set("chemistry", { ...draft.chemistry, pH: num(e.target.value) })} />
              </div>
              <div className="field">
                <label htmlFor="c-h2s">H₂S partial pressure (kPa)</label>
                <input id="c-h2s" inputMode="decimal" value={draft.chemistry.h2sKpa ?? ""}
                  onChange={(e) => set("chemistry", { ...draft.chemistry, h2sKpa: num(e.target.value) })} />
              </div>
              <div className="field">
                <label htmlFor="c-nh3">Ammonia / amines present</label>
                <TriSelect id="c-nh3" value={draft.chemistry.ammonia}
                  onChange={(v) => set("chemistry", { ...draft.chemistry, ammonia: v })} />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>System context — R-1.4</legend>
            <div className="frow">
              <div className="field">
                <label htmlFor="x-galv">Galvanic couple (mating metal)</label>
                <input id="x-galv" value={draft.context.galvanicCouple} placeholder="e.g. Ti-6Al-4V fastener"
                  onChange={(e) => set("context", { ...draft.context, galvanicCouple: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="x-crev">Crevices / deposits</label>
                <TriSelect id="x-crev" value={draft.context.crevices}
                  onChange={(v) => set("context", { ...draft.context, crevices: v })} />
              </div>
              <div className="field">
                <label htmlFor="x-weld">Welded construction</label>
                <TriSelect id="x-weld" value={draft.context.welded}
                  onChange={(v) => set("context", { ...draft.context, welded: v })} />
              </div>
              <div className="field">
                <label htmlFor="x-cp">Cathodic protection</label>
                <TriSelect id="x-cp" value={draft.context.cathodicProtection}
                  onChange={(v) => set("context", { ...draft.context, cathodicProtection: v })} />
              </div>
              <div className="field">
                <label htmlFor="x-lme">Molten-metal contact (LME)</label>
                <select id="x-lme" value={draft.context.lmeContact}
                  onChange={(e) => set("context", { ...draft.context, lmeContact: e.target.value as DutyProfile["context"]["lmeContact"] })}>
                  <option value="unknown">Unknown</option>
                  <option value="none">None</option>
                  <option value="zinc">Zinc (galvanizing / weld-through)</option>
                  <option value="copper">Copper</option>
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>Constraints — R-1.6</legend>
            <div className="frow">
              <div className="field">
                <label htmlFor="k-cost">Max cost (per kg, your currency)</label>
                <input id="k-cost" inputMode="decimal" value={draft.constraints.maxCostPerKg ?? ""}
                  onChange={(e) => set("constraints", { ...draft.constraints, maxCostPerKg: num(e.target.value) })} />
              </div>
              <div className="field">
                <label htmlFor="k-route">Fabrication route</label>
                <select id="k-route" value={draft.constraints.route}
                  onChange={(e) => set("constraints", { ...draft.constraints, route: e.target.value as DutyProfile["constraints"]["route"] })}>
                  <option value="unknown">Unknown</option>
                  <option value="wrought">Wrought</option>
                  <option value="cast">Cast</option>
                  <option value="am">Additive</option>
                </select>
              </div>
            </div>
          </fieldset>
        </div>
      </div>
    </>
  );
}
