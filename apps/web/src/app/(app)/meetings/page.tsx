"use client";

import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronLeft, ChevronRight, Files, Search, X } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { MeetingCard, MeetingCardSkeleton } from "@/components/meetings/meeting-card";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { Button, IconButton } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, Panel } from "@/components/ui/misc";
import { useMeetings, type MeetingFilters } from "@/lib/queries";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "completed", label: "Notes ready" },
  { value: "processing", label: "Processing" },
  { value: "recording", label: "Recording" },
  { value: "interrupted", label: "Interrupted" },
  { value: "failed", label: "Failed" },
];

const initial: MeetingFilters = { q: "", searchTranscript: true, status: "", from: "", to: "", sort: "desc", page: 1 };

/** PRD §5.6 meeting history: search title/transcript, filter by date & status, sort by date. */
export default function MeetingsPage() {
  useBreadcrumbs([{ label: "Dashboard", href: "/" }, { label: "Recent Meetings" }]);
  const [filters, setFilters] = useState<MeetingFilters>(initial);
  const deferredQ = useDeferredValue(filters.q);
  const query = useMeetings({ ...filters, q: deferredQ });
  const data = query.data;
  const set = (patch: Partial<MeetingFilters>) => setFilters((f) => ({ ...f, page: 1, ...patch }));
  const dirty = JSON.stringify(filters) !== JSON.stringify(initial);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-medium tracking-tight text-fg">Meetings</h1>
          <p className="mt-1 text-[15px] text-fg-subtle">
            {data ? `${data.total} meeting${data.total === 1 ? "" : "s"}` : "Loading meetings…"}
          </p>
        </div>
      </div>

      <Panel className="mt-6 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <label htmlFor="meeting-search" className="sr-only">
            Search meetings
          </label>
          <Input
            id="meeting-search"
            type="search"
            placeholder={filters.searchTranscript ? "Search titles and transcripts…" : "Search titles…"}
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
            className="pl-9"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 px-1 text-[13px] text-fg-muted select-none">
          <input
            type="checkbox"
            checked={filters.searchTranscript}
            onChange={(e) => set({ searchTranscript: e.target.checked })}
            className="size-4 cursor-pointer accent-[var(--accent)]"
          />
          Include transcripts
        </label>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
          <label className="sr-only" htmlFor="status-filter">
            Status
          </label>
          <Select id="status-filter" value={filters.status} onChange={(e) => set({ status: e.target.value })} className="sm:w-40">
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <label className="sr-only" htmlFor="from-date">
            From date
          </label>
          <Input id="from-date" type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} className="sm:w-40" />
          <label className="sr-only" htmlFor="to-date">
            To date
          </label>
          <Input
            id="to-date"
            type="date"
            value={filters.to}
            onChange={(e) => set({ to: e.target.value ? `${e.target.value}T23:59:59` : "" })}
            className="sm:w-40"
          />
          <IconButton
            variant="secondary"
            label={filters.sort === "desc" ? "Sorted newest first" : "Sorted oldest first"}
            onClick={() => set({ sort: filters.sort === "desc" ? "asc" : "desc" })}
          >
            {filters.sort === "desc" ? <ArrowDownWideNarrow className="size-4.5" /> : <ArrowUpNarrowWide className="size-4.5" />}
          </IconButton>
        </div>
        {dirty && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(initial)}>
            <X className="size-3.5" aria-hidden /> Clear
          </Button>
        )}
      </Panel>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 lg:gap-4" aria-busy={query.isFetching}>
        {query.isPending ? (
          Array.from({ length: 6 }, (_, i) => <MeetingCardSkeleton key={i} />)
        ) : data && data.items.length > 0 ? (
          data.items.map((m) => <MeetingCard key={m.id} meeting={m} />)
        ) : (
          <Panel className="sm:col-span-2 xl:col-span-3">
            <EmptyState
              icon={Files}
              title={dirty ? "No meetings match these filters" : "No meetings yet"}
              description={dirty ? "Try a different search term or clear the filters." : "Record a Google Meet call to get started."}
              action={dirty ? <Button onClick={() => setFilters(initial)}>Clear filters</Button> : undefined}
            />
          </Panel>
        )}
      </div>

      {data && data.pages > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3">
          <IconButton
            variant="secondary"
            label="Previous page"
            disabled={data.page <= 1}
            onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
          >
            <ChevronLeft className="size-4.5" />
          </IconButton>
          <span className="text-sm text-fg-muted tabular">
            Page {data.page} of {data.pages}
          </span>
          <IconButton
            variant="secondary"
            label="Next page"
            disabled={data.page >= data.pages}
            onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
          >
            <ChevronRight className="size-4.5" />
          </IconButton>
        </nav>
      )}
    </div>
  );
}
