import type { ReactNode } from "react";

export function FilterChips({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}
