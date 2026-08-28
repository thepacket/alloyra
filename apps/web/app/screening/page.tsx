import { ScreeningView } from "../../components/ScreeningView";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staged screening",
  description:
    "Chain family, numeric-limit, and chart-region stages to narrow the alloy database — with progressive grey-out and an auto-generated rationale report.",
  alternates: { canonical: "/screening" },
  openGraph: {
    siteName: "Alloyra",
    title: "Staged screening | Alloyra",
    description:
      "Chain family, numeric-limit, and chart-region stages to narrow the alloy database — with progressive grey-out and an auto-generated rationale report.",
    type: "website",
    images: ["/og.png"],
  },
};

export default function ScreeningPage() {
  return <ScreeningView />;
}
