import { Suspense } from "react";
import { ProfilesView } from "../../components/ProfilesView";

export default function ProfilesPage() {
  return (
    <Suspense>
      <ProfilesView />
    </Suspense>
  );
}
