import Link from "next/link";
import { alloys, failureRules, DATASET_VERSION, RULESET_VERSION } from "@alloyra/data";

/**
 * Workbench home: the five-stage workflow made explicit (the funnel from
 * the blueprint), plus dataset coverage stated up front — visitors should
 * know they are looking at a 13-alloy screening tool, not an encyclopedia.
 */
const steps = [
  {
    href: "/database",
    name: "Alloy database",
    desc: "Browse the seed dataset — spec-min properties with provenance and citations on every value.",
    cta: "Search alloys",
  },
  {
    href: "/profiles",
    name: "Duty profile",
    desc: "Capture the application: temperatures, load type, chemistry, welds, couples — the inputs everything downstream consumes.",
    cta: "Create duty profile",
  },
  {
    href: "/comparisons",
    name: "Comparison",
    desc: "Rank up to six alloy-in-condition candidates against the duty with transparent, user-weighted scoring.",
    cta: "Open comparison",
  },
  {
    href: "/rules",
    name: "Failure audit",
    desc: "Interaction failure modes — SCC, hydrogen embrittlement, creep, galvanic — as versioned, cited, editable rules.",
    cta: "Review rules",
  },
  {
    href: "/studio",
    name: "Composition studio",
    desc: "Tune composition off a base grade with live calculators, nearest-grade matching, and CALPHAD equilibrium.",
    cta: "Open studio",
  },
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

        <section className="home-coverage">
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
          </div>
          <p className="coverage-note">
            Property values are standards&apos; published minimums or clearly
            flagged typicals; nothing is reproduced from licensed databases.
            All seed failure rules are drafts awaiting expert review and do not
            run in comparisons unless explicitly included there. Everything you
            create — duty profiles, comparisons, rule edits — is stored in
            this browser only; each page offers a JSON export for backup.
          </p>
        </section>
      </div>
    </div>
  );
}
