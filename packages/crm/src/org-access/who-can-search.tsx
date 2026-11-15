"use client";

import { Input } from "@foundry/ui/input";
import type { WhoCanHit } from "./access-model";

export type WhoCanSearchProps = {
  value: string;
  onChange: (value: string) => void;
  results: WhoCanHit[];
  /** Maps a row id to a display name; defaults to the id. */
  nameOf?: (rowId: string) => string;
};

export function WhoCanSearch({ value, onChange, results, nameOf = (id) => id }: WhoCanSearchProps) {
  return (
    <div className="grid gap-3">
      <Input
        type="search"
        aria-label="Search actions, for example refund"
        placeholder="Who can refund?"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value.trim() && results.length === 0 && <p className="text-sm text-muted-foreground">No action matches.</p>}
      {results.length > 0 && (
        <ul className="grid gap-3">
          {results.map((hit) => (
            <li key={`${hit.resource}/${hit.action}`} className="grid gap-1">
              <p className="text-sm font-medium">{hit.label}</p>
              {hit.holders.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nobody has this.</p>
              ) : (
                <ul className="grid gap-0.5">
                  {hit.holders.map((h) => (
                    <li key={h.rowId} className="text-xs text-muted-foreground">
                      {nameOf(h.rowId)} via {h.roles.join(", ") || "a role"}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
