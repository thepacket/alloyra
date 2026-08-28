import { RulesView } from "../../components/RulesView";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Failure Rules",
  description: "Interaction failure modes — SCC, hydrogen embrittlement, creep, galvanic — as versioned, cited, editable rules.",
  alternates: { canonical: "/rules" },
  openGraph: {
    siteName: "Alloyra",
    title: "Failure Rules | Alloyra",
    description: "Interaction failure modes — SCC, hydrogen embrittlement, creep, galvanic — as versioned, cited, editable rules.",
    type: "website",
    images: ["/og.png"],
  },
};

export default function RulesPage() {
  return <RulesView />;
}
