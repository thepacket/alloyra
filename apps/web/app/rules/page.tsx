import { describeClause } from "@alloyra/core";
import { failureRules, RULESET_VERSION } from "@alloyra/data";

/**
 * The rules browser (R-5.3): every rule is reviewable — trigger clauses in
 * plain language, mechanism, citation, mitigations, and review status.
 * This page is what a domain expert marks up.
 */
export default function RulesPage() {
  return (
    <>
      <div className="pane-header">
        <h1>Failure rules</h1>
        <span className="count">
          {failureRules.length} rules · ruleset {RULESET_VERSION}
        </span>
      </div>
      <div className="rules-scroll">
        <div className="rules-intro">
          Rules are data, not code: versioned, individually cited, and none
          fire on duty fields the profile leaves unspecified. Every hit is a
          flag for expert judgment, never a verdict. All thresholds below are
          textbook anchors awaiting expert review — blueprint § 12, question 2.
        </div>
        {failureRules.map((r) => (
          <article className="rule-card" key={r.id}>
            <header>
              <span className={`sev-chip ${r.severity}`}>{r.severity.toUpperCase()}</span>
              <h2>{r.name}</h2>
              <span className="rule-id mono">{r.id}</span>
            </header>
            <div className="rule-when">
              <span className="wlbl">Fires when all of:</span>
              <ul>
                {r.when.map((c, i) => (
                  <li key={i}>{describeClause(c)}</li>
                ))}
              </ul>
            </div>
            <p className="rule-mech">{r.mechanism}</p>
            <div className="rule-mit">
              <span className="wlbl">Mitigations</span>
              <ul>
                {r.mitigations.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
            <footer>
              <span className="mono">{r.citation}</span>
              <span className="review-flag">{r.reviewedBy}</span>
            </footer>
          </article>
        ))}
      </div>
    </>
  );
}
