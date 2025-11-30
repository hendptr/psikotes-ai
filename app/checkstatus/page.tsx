'use client';

import { useEffect, useState } from "react";
import CheckStatusPanel from "@/components/check-status-panel";

export const dynamic = "force-dynamic";

export default function CheckStatusPage() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    // Simple guard to avoid accidental discovery via rendering issues; real protection is auth.
    setAllowed(true);
  }, []);

  if (!allowed) {
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <CheckStatusPanel />
    </div>
  );
}
