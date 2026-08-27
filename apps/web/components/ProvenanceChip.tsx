import type { Provenance } from "@alloyra/core";

const labels: Record<Provenance, string> = {
  measured: "MEAS",
  "spec-min": "SPEC-MIN",
  computed: "COMPUTED",
  estimated: "EST",
};

export function ProvenanceChip({ p, title }: { p: Provenance; title?: string }) {
  return (
    <span className={`prov ${p}`} title={title ?? p}>
      {labels[p]}
    </span>
  );
}
