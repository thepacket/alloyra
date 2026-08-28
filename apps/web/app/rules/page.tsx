import { RulesView } from "../../components/RulesView";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Failure Rules",
  description: "Interaction failure modes — SCC, hydrogen embrittlement, creep, galvanic — as versioned, cited, editable rules.",
};

export default function RulesPage() {
  return <RulesView />;
}
