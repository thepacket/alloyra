import { StudioView } from "../../components/StudioView";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Composition Studio",
  description: "Tune composition off a base grade with live calculators, sweep plots, nearest-grade matching, and CALPHAD equilibrium.",
  alternates: { canonical: "/studio" },
  openGraph: {
    siteName: "Alloyra",
    title: "Composition Studio | Alloyra",
    description: "Tune composition off a base grade with live calculators, sweep plots, nearest-grade matching, and CALPHAD equilibrium.",
    type: "website",
    images: ["/og.png"],
  },
};

export default function StudioPage() {
  return <StudioView />;
}
