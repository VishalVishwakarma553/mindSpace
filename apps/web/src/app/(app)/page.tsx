"use client";

import { ArrowRight, Clock3, FileAudio, ListChecks, Loader2, Plug, RotateCcw } from "lucide-react";
import Link from "next/link";
import { MeetingCard, MeetingCardSkeleton } from "@/components/meetings/meeting-card";
import { StatusBadge } from "@/components/meetings/status-badge";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { Button, buttonStyles } from "@/components/ui/button";
import { EmptyState, Panel, ProgressBar, SectionTitle, Skeleton } from "@/components/ui/misc";
import { formatDuration, relativeTime } from "@/lib/format";
import { useMe, useReprocess, useStats } from "@/lib/queries";
import type { Meeting } from "@/lib/types";

function StatCard({ icon: Icon, label, value, hint }: { icon: typeof Clock3; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Panel className="p-5">
      <div className="flex items-center gap-2.5 text-[13px] text-fg-subtle">
        <Icon className="size-4" aria-hidden />
        {label}
      </div>
      <p className="mt-3 text-[28px] leading-none font-medium text-fg tabular">{value}</p>
      {hint && <p className="mt-2 text-xs text-fg-subtle">{hint}</p>}
    </Panel>
  );
}

function ActiveRow({ meeting }: { meeting: Meeting }) {
  const reprocess = useReprocess(meeting.id);
  const canRetry = meeting.status === "failed" || meeting.status === "interrupted";
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <Link href={`/meetings/${meeting.id}`} className="block truncate text-[15px] font-medium text-fg hover:underline">
          {meeting.title}
        </Link>
        <p className="mt-0.5 truncate text-[13px] text-fg-subtle">
          {meeting.status === "processing" && meeting.progress.total > 0
            ? `${meeting.processingStage === "summarizing" ? "Writing notes" : "Transcribing audio"} · step ${meeting.progress.done} of ${meeting.progress.total}`
            : meeting.processingError || `Updated ${relativeTime(meeting.startedAt)}`}
        </p>
        {meeting.status === "processing" && meeting.progress.total > 0 && (
          <ProgressBar value={meeting.progress.done / meeting.progress.total} label={`${meeting.title} progress`} className="mt-2.5 max-w-md" />
        )}
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge meeting={meeting} />
        {canRetry && (
          <Button size="sm" onClick={() => reprocess.mutate("all")} loading={reprocess.isPending}>
            <RotateCcw className="size-3.5" aria-hidden /> {meeting.status === "interrupted" ? "Process saved audio" : "Retry"}
          </Button>
        )}
      </div>
    </li>
  );
}

export default function DashboardPage() {
  useBreadcrumbs([{ label: "Dashboard" }]);
  const me = useMe();
  const stats = useStats();
  const s = stats.data;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-medium tracking-tight text-fg">
          {greeting}, {me.data?.name.split(" ")[0]}
        </h1>
        <p className="text-[15px] text-fg-subtle">Here&apos;s what happened across your meetings.</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats.isPending ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[118px] rounded-2xl" />)
        ) : (
          <>
            <StatCard icon={FileAudio} label="Total meetings" value={s?.totalMeetings ?? 0} />
            <StatCard icon={Clock3} label="Recorded time" value={formatDuration(s?.totalDuration ?? 0)} />
            <StatCard icon={ListChecks} label="Open action items" value={s?.openActionItems ?? 0} />
            <StatCard
              icon={Loader2}
              label="Pending jobs"
              value={s?.active.filter((m) => m.status === "processing").length ?? 0}
              hint="Transcription & summaries"
            />
          </>
        )}
      </div>

      {s && s.active.length > 0 && (
        <Panel className="mt-6">
          <div className="border-b border-border px-5 py-4">
            <SectionTitle icon={Loader2}>Needs attention</SectionTitle>
          </div>
          <ul className="divide-y divide-border">
            {s.active.map((m) => (
              <ActiveRow key={m.id} meeting={m} />
            ))}
          </ul>
        </Panel>
      )}

      <div className="mt-8">
        <SectionTitle
          action={
            <Link href="/meetings" className={buttonStyles({ variant: "ghost", size: "sm" })}>
              View all <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
        >
          Recently processed
        </SectionTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 lg:gap-4">
          {stats.isPending ? (
            Array.from({ length: 3 }, (_, i) => <MeetingCardSkeleton key={i} />)
          ) : s && s.recent.length > 0 ? (
            s.recent.map((m) => <MeetingCard key={m.id} meeting={m} />)
          ) : (
            <Panel className="sm:col-span-2 xl:col-span-3">
              <EmptyState
                icon={Plug}
                title="No meetings yet"
                description="Install the Chrome extension, join a Google Meet call and press Start recording. Your notes will show up here."
                action={
                  <Link href="/setup" className={buttonStyles({ variant: "primary" })}>
                    Open setup guide
                  </Link>
                }
              />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
