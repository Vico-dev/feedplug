"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function IARedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/optimiser/ia");
  }, [router]);
  return null;
}
