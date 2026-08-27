import { Suspense } from "react";
import { DatabaseView } from "../../components/DatabaseView";

export default function DatabasePage() {
  return (
    <Suspense>
      <DatabaseView />
    </Suspense>
  );
}
