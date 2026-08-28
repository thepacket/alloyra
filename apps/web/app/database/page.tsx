import { Suspense } from "react";
import { DatabaseView } from "../../components/DatabaseView";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Alloy Database",
  description: "Search 27 spec-cited alloys by property, family, strengthening mechanism, and microstructural features — with provenance on every value.",
};

export default function DatabasePage() {
  return (
    <Suspense>
      <DatabaseView />
    </Suspense>
  );
}
