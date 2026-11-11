"use client";

import { CalendarDays, Check, ChevronUp, CircleHelp, ListChecks, MoreHorizontal, Pencil, Play, Plus, Trash2, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Chip, EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { formatDeadline, formatLongDate } from "@/lib/format";
import { useActionItemMutations } from "@/lib/queries";
import type { ActionItem } from "@/lib/types";
import { usePlayer } from "./player";
import { TaskDialog, type TaskValues } from "./task-dialog";

interface Group {
  key: string;
  label: string;
  items: ActionItem[];
}

/** Group tasks by deadline day (as in the reference design); undated tasks go last. */
function groupTasks(items: ActionItem[]): Group[] {
  const map = new Map<string, ActionItem[]>();
  for (const item of items) {
    const key = item.deadline ? item.deadline.slice(0, 10) : "none";
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === "none" ? 1 : b === "none" ? -1 : a.localeCompare(b)))
    .map(([key, list]) => ({
      key,
      label: key === "none" ? "No deadline" : formatLongDate(`${key}T12:00:00Z`),
      items: list,
    }));
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="group/check relative -m-2 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center"
    >
      <span
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-full border transition-all duration-150",
          checked ? "border-accent bg-accent" : "border-fg-subtle/60 group-hover/check:border-fg-muted",
        )}
      >
        {checked && <Check className="size-3 text-white" strokeWidth={3} aria-hidden />}
      </span>
    </button>
  );
}

function TaskRow({
  item,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: ActionItem;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const p = usePlayer();
  const done = item.status === "done";
  return (
    <li className="group flex items-start gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-surface-2/60">
      <span className="pt-0.5">
        <Checkbox checked={done} onChange={onToggle} label={`Mark "${item.task}" as ${done ? "not done" : "done"}`} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[15px] leading-6 transition-colors", done ? "text-fg-subtle line-through decoration-fg-subtle/50" : "text-fg")}>
          {item.task}
        </p>
        {(item.assignedTo || item.uncertain || (!item.deadline && item.deadlineText)) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {item.assignedTo && (
              <Chip className="h-6 text-xs">
                <UserRound className="size-3" aria-hidden /> {item.assignedTo}
              </Chip>
            )}
            {!item.deadline && item.deadlineText && <Chip className="h-6 text-xs">“{item.deadlineText}”</Chip>}
            {item.uncertain && (
              <Chip tone="amber" className="h-6 text-xs" title="Owner, scope or deadline was ambiguous in the transcript">
                <CircleHelp className="size-3" aria-hidden /> Needs confirmation
              </Chip>
            )}
          </div>
        )}
      </div>
      {item.deadline && (
        <span className="hidden shrink-0 pt-0.5 text-[15px] text-fg-subtle sm:block tabular">{formatDeadline(item.deadline)}</span>
      )}
      <Menu>
        <MenuTrigger asChild>
          <IconButton label={`Actions for "${item.task}"`} size="sm" tooltip={false} className="-my-0.5 opacity-70 group-hover:opacity-100">
            <MoreHorizontal className="size-4.5" />
          </IconButton>
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={onEdit}>
            <Pencil aria-hidden /> Edit task
          </MenuItem>
          {item.timestamp !== null && (
            <MenuItem onSelect={() => p.seek(item.timestamp!, { play: p.hasAudio ? true : undefined })}>
              <Play aria-hidden /> Jump to moment
            </MenuItem>
          )}
          <MenuItem onSelect={onDelete} className="text-danger data-[highlighted]:text-danger">
            <Trash2 aria-hidden /> Delete
          </MenuItem>
        </MenuContent>
      </Menu>
    </li>
  );
}

export function TasksSection({ meetingId, items, participants }: { meetingId: string; items: ActionItem[]; participants: string[] }) {
  const groups = useMemo(() => groupTasks(items), [items]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dialog, setDialog] = useState<{ open: boolean; item: ActionItem | null }>({ open: false, item: null });
  const { update, create, remove } = useActionItemMutations(meetingId);

  const save = (v: TaskValues) => {
    const body = { task: v.task, assignedTo: v.assignedTo, deadline: v.deadline || null };
    const done = { onSuccess: () => setDialog({ open: false, item: null }) };
    if (dialog.item) update.mutate({ itemId: dialog.item._id, ...body }, done);
    else create.mutate(body, done);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-xl font-medium text-fg">
          <ListChecks className="size-5 text-fg-muted" aria-hidden />
          Tasks From This Meeting
        </h2>
        <Button size="sm" onClick={() => setDialog({ open: true, item: null })}>
          <Plus className="size-3.5" aria-hidden /> Add task
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={ListChecks} title="No action items" description="Nothing in the transcript was clearly assigned as a task." className="py-10" />
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {groups.map((g) => {
            const isCollapsed = collapsed[g.key];
            const panelId = `tasks-${g.key}`;
            return (
              <section key={g.key} aria-label={g.label}>
                <button
                  type="button"
                  aria-expanded={!isCollapsed}
                  aria-controls={panelId}
                  onClick={() => setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))}
                  className="flex h-12 w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 text-left text-[15px] text-fg-muted transition-colors hover:border-border-strong"
                >
                  <CalendarDays className="size-4.5 text-fg-subtle" aria-hidden />
                  <span className="flex-1">{g.label}</span>
                  <span className="text-xs text-fg-subtle tabular">
                    {g.items.filter((i) => i.status === "done").length}/{g.items.length}
                  </span>
                  <ChevronUp className={cn("size-4.5 transition-transform duration-200", isCollapsed && "rotate-180")} aria-hidden />
                </button>
                {!isCollapsed && (
                  <ul id={panelId} className="mt-1">
                    {g.items.map((item) => (
                      <TaskRow
                        key={item._id}
                        item={item}
                        onToggle={() => update.mutate({ itemId: item._id, status: item.status === "done" ? "open" : "done" })}
                        onEdit={() => setDialog({ open: true, item })}
                        onDelete={() => remove.mutate(item._id)}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <TaskDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        item={dialog.item}
        participants={participants}
        onSubmit={save}
        saving={update.isPending || create.isPending}
      />
    </div>
  );
}
