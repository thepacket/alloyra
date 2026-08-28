import { Suspense } from "react";
import { DatabaseView } from "../../components/DatabaseView";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Alloy Database",
  description: "Search 27 spec-cited alloys by property, family, strengthening mechanism, and microstructural features — with provenance on every value.",
  alternates: { canonical: "/database" },
  openGraph: {
    siteName: "Alloyra",
    title: "Alloy Database | Alloyra",
    description: "Search 27 spec-cited alloys by property, family, strengthening mechanism, and microstructural features — with provenance on every value.",
    type: "website",
    images: ["/og.png"],
  },
};

export default function DatabasePage() {
  return (
    <Suspense>
      <DatabaseView />
    </Suspense>
  );
}
