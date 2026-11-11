"use client";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
export function RefreshOperationsButton() {
  return (
    <Button variant="secondary" onClick={() => window.location.reload()}>
      <RefreshCw size={15} aria-hidden="true" /> Muat ulang
    </Button>
  );
}
