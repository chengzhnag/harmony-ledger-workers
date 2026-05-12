import React from "react";
import type { Ledger, RenqingRecord } from "@shared/types";
// Neutralized demo component to fix build errors while maintaining structural reference
export default function TemplateDemo() {
  const [ledgers] = React.useState<Ledger[]>([]);
  const [records] = React.useState<RenqingRecord[]>([]);
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Boilerplate Reference</h2>
      <div className="grid gap-2">
        {ledgers.length === 0 && records.length === 0 && (
          <p className="text-muted-foreground">Demo content cleared for production.</p>
        )}
      </div>
    </div>
  );
}