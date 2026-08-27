"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Client-side redirect — server redirects don't exist in a static export. */
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/database");
  }, [router]);
  return null;
}
