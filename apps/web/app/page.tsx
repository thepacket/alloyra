import Link from "next/link";
import { alloys, failureRules, DATASET_VERSION, RULESET_VERSION } from "@alloyra/data";
import { HomeMiniChart } from "../components/HomeMiniChart";

/**
 * Workbench home: the five-stage workflow made explicit (the funnel from
 * the blueprint), plus dataset coverage stated up front — coverage numbers
 * are computed from the dataset, never hardcoded.
 */
const steps = [
  { href: "/profiles?from=screening", name: "Define the duty", desc: "Record service temperatures, loads, chemistry and fabrication context. Missing inputs stay explicit.", cta: "Define duty" },
  { href: "/screening", name: "Screen candidates", desc: "Apply staged limits and chart regions. Keep a rationale for every elimination before sending a shortlist to comparison.", cta: "Open screening" },
  { href: "/comparisons", name: "Compare the shortlist", desc: "Inspect performance contributions, input coverage and condition-specific property records for up to six candidates.", cta: "Compare candidates" },
  { href: "/comparisons#failure-audit", name: "Inspect risks and evidence", desc: "Review rule hits, unresolved inputs and assumptions. Draft-rule results remain visibly distinct from expert review.", cta: "Inspect failure audit" },
  { href: "/studio", name: "Explore composition", desc: "Tune a base composition and inspect applicable models with explicit inputs, origins and validity limits.", cta: "Open studio" },
];

export default function Home() {
  const familyRoots = [...new Set(alloys.map((a) => a.family[0]))];
  const drafts = failureRules.filter((r) => r.reviewStatus === "draft").length;
  return (
    <div className="home-scroll">
      <div className="home">
        <header className="home-head">
          <h1>Alloy-design workbench</h1>
          <p>
            Capture the duty, rank candidates, audit the interaction failure
            modes a property filter can&apos;t catch, and tune composition off a
            base grade. Outputs are <strong>screening guidance for expert
            judgment</strong> — never design approval.
          </p>
        </header>

        <div className="home-actions">
          <Link className="btn" href="/profiles?from=screening">Define duty →</Link>
          <Link className="btn ghost" href="/comparisons?example=seawater">Explore seawater example</Link>
          <Link href="/database">Browse alloy data</Link>
        </div>
        <p className="coverage-note">Your active study follows you across the workbench. Name it above; duty and shortlist stay visible as you move between tools.</p>
        <ol className="home-steps">
          {steps.map((s, i) => (
            <li key={s.href}>
              <Link href={s.href} className="home-step">
                <span className="step-no mono">{String(i + 1).padStart(2, "0")}</span>
                <span className="step-body">
                  <span className="step-name">{s.name}</span>
                  <span className="step-desc">{s.desc}</span>
                  <span className="step-cta">{s.cta} →</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>

        <HomeMiniChart />

        <section className="home-coverage">
          <h2 className="studio-h">Release boundary — research preview</h2>
          <div className="boundary">
            <div className="boundary-col">
              <span className="boundary-h ok">Appropriate use</span>
              <ul>
                <li>Demonstration and materials education</li>
                <li>Preliminary screening and shortlisting</li>
                <li>Hypothesis generation for expert review</li>
                <li>Failure-rule drafting and development</li>
              </ul>
            </div>
            <div className="boundary-col">
              <span className="boundary-h no">Not appropriate</span>
              <ul>
                <li>Material qualification or procurement specification</li>
                <li>Code-compliance decisions</li>
                <li>Safety-critical design approval</li>
                <li>Any use without independent expert judgment</li>
              </ul>
            </div>
          </div>

          <h2 className="studio-h">Current coverage — read before trusting</h2>
          <div className="coverage-grid">
            <div className="cov">
              <span className="cov-n mono">{alloys.length}</span>
              <span className="cov-l">alloys ({familyRoots.join(" · ")}) — dataset {DATASET_VERSION}</span>
            </div>
            <div className="cov">
              <span className="cov-n mono">{failureRules.length}</span>
              <span className="cov-l">
                failure rules, {drafts} in draft — ruleset {RULESET_VERSION}
              </span>
            </div>
            <div className="cov">
              <span className="cov-n mono">7</span>
              <span className="cov-l">calculators with formulas, sources, and validity windows</span>
            </div>
            <div className="cov">
              <span className="cov-n mono">
                {alloys.reduce((n, a) => n + a.conditions.filter((c) => c.microstructure).length, 0)}
              </span>
              <span className="cov-l">
                conditions with cited microstructure descriptors — searchable by
                mechanism, twinning, and grain-boundary character
              </span>
            </div>
          </div>
          <p className="coverage-note">
            Property values are standards&apos; published minimums or clearly
            flagged typicals; nothing is reproduced from licensed databases.
            All seed failure rules are drafts awaiting expert review and do not
            run in comparisons unless explicitly included there. Everything you
            create — duty profiles, comparisons, rule edits — is stored in
            this browser only. Use the available profile, rule, screening and studio exports to keep a record.
          </p>
        </section>
      </div>
    </div>
  );
}
