"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";

export interface Crumb {
  label: string;
  href?: string;
}

const Ctx = createContext<{ crumbs: Crumb[]; setCrumbs: (c: Crumb[]) => void }>({ crumbs: [], setCrumbs: () => {} });

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  return <Ctx.Provider value={{ crumbs, setCrumbs }}>{children}</Ctx.Provider>;
}

/**
 * Pages declare their trail. Because Next keeps hidden routes mounted (Activity),
 * the effect re-runs whenever a page becomes visible again, so the trail stays correct.
 */
export function useBreadcrumbs(crumbs: Crumb[]) {
  const { setCrumbs } = useContext(Ctx);
  const serialized = JSON.stringify(crumbs);
  useEffect(() => {
    setCrumbs(JSON.parse(serialized) as Crumb[]);
  }, [serialized, setCrumbs]);
}

export function Breadcrumbs() {
  const { crumbs } = useContext(Ctx);
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-2 text-[15px] sm:text-base">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${c.label}-${i}`} className={last ? "min-w-0 truncate" : "hidden shrink-0 items-center gap-2 md:flex"}>
              {last ? (
                <span aria-current="page" className="truncate text-fg">
                  {c.label}
                </span>
              ) : (
                <>
                  {c.href ? (
                    <Link href={c.href} className="text-fg-subtle transition-colors hover:text-fg">
                      {c.label}
                    </Link>
                  ) : (
                    <span className="text-fg-subtle">{c.label}</span>
                  )}
                  <ChevronRight className="size-4 text-fg-subtle" aria-hidden />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
