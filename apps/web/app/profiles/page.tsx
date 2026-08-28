import { Suspense } from "react";
import { ProfilesView } from "../../components/ProfilesView";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Duty Profiles",
  description: "Capture the application: temperatures, loads, chemistry, welds, and couples — the inputs the failure audit consumes.",
  alternates: { canonical: "/profiles" },
  openGraph: {
    siteName: "Alloyra",
    title: "Duty Profiles | Alloyra",
    description: "Capture the application: temperatures, loads, chemistry, welds, and couples — the inputs the failure audit consumes.",
    type: "website",
    images: ["/og.png"],
  },
};

export default function ProfilesPage() {
  return (
    <Suspense>
      <ProfilesView />
    </Suspense>
  );
}
