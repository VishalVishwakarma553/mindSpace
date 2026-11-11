"use client";

import {
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Download,
  FileDown,
  Link2,
  Mail,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  RefreshCw,
  Share2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/meetings/status-badge";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Chip, tagTone } from "@/components/ui/misc";
import { api, errorMessage, exportUrl } from "@/lib/api";
import { formatDate, formatDuration, formatTime } from "@/lib/format";
import { useInvalidateMeeting, useReprocess, useUpdateMeeting } from "@/lib/queries";
import type { Meeting, MeetingNotes } from "@/lib/types";
import { FollowUpDialog } from "./follow-up-dialog";

function EditableTitle({ meeting }: { meeting: Meeting }) {
  const update = useUpdateMeeting(meeting.id);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(meeting.title);

  if (editing) {
    return (
      <form
        className="flex flex-1 items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const title = value.trim();
          if (title && title !== meeting.title) update.mutate({ title }, { onSuccess: () => setEditing(false) });
          else setEditing(false);
        }}
      >
        <label htmlFor="title-input" className="sr-only">
          Meeting title
        </label>
        <Input
          id="title-input"
          autoFocus
          value={value}
          maxLength={200}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          className="h-11 text-xl font-medium"
        />
        <IconButton type="submit" label="Save title" variant="secondary" disabled={update.isPending}>
          <Check className="size-4.5" />
        </IconButton>
        <IconButton label="Cancel" onClick={() => setEditing(false)}>
          <X className="size-4.5" />
        </IconButton>
      </form>
    );
  }
  // Show the meeting name without the "Org |" prefix used in breadcrumbs.
  const display = meeting.title.includes(" | ") ? meeting.title.split(" | ").slice(1).join(" | ") : meeting.title;
  return (
    <div className="group flex min-w-0 flex-1 items-start gap-2">
      <h1 className="text-[26px] leading-tight font-medium tracking-tight text-fg sm:text-[32px]">{display}</h1>
      <IconButton
        label="Rename meeting"
        size="sm"
        className="mt-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={() => {
          setValue(meeting.title);
          setEditing(true);
        }}
      >
        <Pencil className="size-4" />
      </IconButton>
    </div>
  );
}

function Tags({ meeting }: { meeting: Meeting }) {
  const update = useUpdateMeeting(meeting.id);
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const setTags = (tags: string[]) => update.mutate({ tags });

  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Tags">
      {meeting.tags.map((t, i) => (
        <li key={t}>
          <Chip tone={tagTone(i)} className="group/tag h-9 rounded-lg px-3 text-sm">
            {t}
            <button
              type="button"
              aria-label={`Remove tag ${t}`}
              onClick={() => setTags(meeting.tags.filter((x) => x !== t))}
              className="-mr-1 hidden cursor-pointer rounded p-0.5 opacity-70 group-hover/tag:inline-flex hover:opacity-100 focus-visible:inline-flex"
            >
              <X className="size-3" />
            </button>
          </Chip>
        </li>
      ))}
      <li>
        {adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const tag = value.trim();
              if (tag && !meeting.tags.includes(tag)) setTags([...meeting.tags, tag]);
              setValue("");
              setAdding(false);
            }}
          >
            <label htmlFor="new-tag" className="sr-only">
              New tag
            </label>
            <Input
              id="new-tag"
              autoFocus
              value={value}
              maxLength={40}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => setAdding(false)}
              onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
              placeholder="Tag name"
              className="h-9 w-36"
            />
          </form>
        ) : (
          meeting.tags.length < 10 && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-border-strong px-3 text-sm text-fg-subtle transition-colors hover:text-fg"
            >
              <Plus className="size-3.5" aria-hidden /> Tag
            </button>
          )
        )}
      </li>
    </ul>
  );
}

export function MeetingHeader({
  meeting,
  notes,
  focusMode,
  onToggleFocus,
}: {
  meeting: Meeting;
  notes: MeetingNotes | null;
  focusMode: boolean;
  onToggleFocus: () => void;
}) {
  const router = useRouter();
  const invalidate = useInvalidateMeeting();
  const reprocess = useReprocess(meeting.id);
  const [expanded, setExpanded] = useState(false);
  const [followUp, setFollowUp] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const summary = notes?.executiveSummary || notes?.objective || "";
  const end = meeting.endedAt ?? new Date(new Date(meeting.startedAt).getTime() + meeting.duration * 1000).toISOString();
  const busy = ["recording", "paused", "processing"].includes(meeting.status);

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied", { description: "Only you can open it while signed in." });
  };

  const onDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/meetings/${meeting.id}`);
      invalidate();
      toast.success("Meeting deleted");
      router.replace("/meetings");
    } catch (e) {
      toast.error(errorMessage(e));
      setDeleting(false);
    }
  };

  return (
    <header>
      <div className="flex items-start justify-between gap-3">
        <EditableTitle meeting={meeting} />
        <div className="flex shrink-0 items-center gap-2">
          <IconButton
            label={focusMode ? "Show player & transcript" : "Focus on notes"}
            variant="secondary"
            onClick={onToggleFocus}
            className="hidden lg:inline-flex"
          >
            {focusMode ? <PanelRightOpen className="size-5" /> : <PanelRightClose className="size-5" />}
          </IconButton>
          <Menu>
            <MenuTrigger asChild>
              <IconButton label="Share & export" variant="secondary" tooltip={false}>
                <Share2 className="size-5" />
              </IconButton>
            </MenuTrigger>
            <MenuContent className="w-64">
              <MenuItem onSelect={copyLink}>
                <Copy aria-hidden /> Copy link
              </MenuItem>
              <MenuItem onSelect={() => setFollowUp(true)} disabled={!notes}>
                <Mail aria-hidden /> Draft follow-up email
              </MenuItem>
              <MenuSeparator />
              <MenuLabel>Complete notes</MenuLabel>
              {(["pdf", "md", "txt"] as const).map((f) => (
                <MenuItem key={f} asChild>
                  <a href={exportUrl(meeting.id, f)} download>
                    <FileDown aria-hidden /> {f === "md" ? "Markdown" : f.toUpperCase()}
                  </a>
                </MenuItem>
              ))}
              <MenuSeparator />
              <MenuLabel>Export part</MenuLabel>
              <MenuItem asChild>
                <a href={exportUrl(meeting.id, "pdf", "summary")} download>
                  <Download aria-hidden /> Summary (PDF)
                </a>
              </MenuItem>
              <MenuItem asChild>
                <a href={exportUrl(meeting.id, "md", "actions")} download>
                  <Download aria-hidden /> Action items (Markdown)
                </a>
              </MenuItem>
              <MenuItem asChild>
                <a href={exportUrl(meeting.id, "txt", "transcript")} download>
                  <Download aria-hidden /> Transcript (TXT)
                </a>
              </MenuItem>
            </MenuContent>
          </Menu>
          <Menu>
            <MenuTrigger asChild>
              <IconButton label="More actions" variant="secondary" tooltip={false}>
                <MoreHorizontal className="size-5" />
              </IconButton>
            </MenuTrigger>
            <MenuContent>
              <MenuItem disabled={busy || !notes} onSelect={() => reprocess.mutate("summary")}>
                <Sparkles aria-hidden /> Regenerate notes
              </MenuItem>
              <MenuItem disabled={busy} onSelect={() => reprocess.mutate("all")}>
                <RefreshCw aria-hidden /> Reprocess from audio
              </MenuItem>
              <MenuSeparator />
              <MenuItem onSelect={() => setConfirmDelete(true)} className="text-danger data-[highlighted]:text-danger">
                <Trash2 aria-hidden /> Delete meeting
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>

      {summary ? (
        <div className="mt-3">
          <p className={expanded ? "text-[17px] leading-8 text-fg-muted" : "line-clamp-4 text-[17px] leading-8 text-fg-muted"}>{summary}</p>
          {summary.length > 320 && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-1 cursor-pointer text-sm font-medium text-fg underline-offset-4 hover:underline"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      ) : (
        <p className="mt-3 text-[17px] text-fg-subtle">The AI summary will appear here when processing completes.</p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] text-fg-muted">
        <span className="inline-flex items-center gap-2">
          <CalendarDays className="size-4.5 text-fg-subtle" aria-hidden />
          {formatDate(meeting.startedAt)}
          <span className="text-fg-subtle" aria-hidden>
            |
          </span>
          <span className="tabular">
            {formatTime(meeting.startedAt)} - {formatTime(end)}
          </span>
        </span>
        <span className="inline-flex items-center gap-2 tabular">
          <Clock3 className="size-4.5 text-fg-subtle" aria-hidden />
          {formatDuration(meeting.duration)}
        </span>
        {meeting.meetingUrl && (
          <a
            href={meeting.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center gap-2 transition-colors hover:text-fg"
          >
            <Link2 className="size-4.5 shrink-0 text-fg-subtle" aria-hidden />
            <span className="truncate">{meeting.meetingUrl.replace(/^https?:\/\//, "")}</span>
          </a>
        )}
        {meeting.status !== "completed" && <StatusBadge meeting={meeting} />}
      </div>

      <div className="mt-5">
        <Tags meeting={meeting} />
      </div>

      <FollowUpDialog open={followUp} onOpenChange={setFollowUp} meetingId={meeting.id} />
      <Dialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this meeting?"
        description="The recording, transcript, notes and tasks will be permanently removed from this device."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onDelete} loading={deleting}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg-muted">
          <span className="font-medium text-fg">{meeting.title}</span> · {formatDate(meeting.startedAt)}
        </p>
      </Dialog>
    </header>
  );
}
