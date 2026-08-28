import { ComparisonView } from "../../components/ComparisonView";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comparison",
  description: "Rank alloy-in-condition candidates against a duty with transparent weighted scoring and a failure-mode audit.",
  alternates: { canonical: "/comparisons" },
  openGraph: {
    siteName: "Alloyra",
    title: "Comparison | Alloyra",
    description: "Rank alloy-in-condition candidates against a duty with transparent weighted scoring and a failure-mode audit.",
    type: "website",
    images: ["/og.png"],
  },
};

export default function ComparisonsPage() {
  return <ComparisonView />;
}
