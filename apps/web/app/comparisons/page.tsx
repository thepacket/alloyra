import { ComparisonView } from "../../components/ComparisonView";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comparison",
  description: "Rank alloy-in-condition candidates against a duty with transparent weighted scoring and a failure-mode audit.",
};

export default function ComparisonsPage() {
  return <ComparisonView />;
}
