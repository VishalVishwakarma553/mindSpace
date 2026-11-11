"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import type { ActionItem } from "@/lib/types";

export interface TaskValues {
  task: string;
  assignedTo: string;
  deadline: string; // YYYY-MM-DD or ""
}

export function TaskDialog({
  open,
  onOpenChange,
  item,
  participants,
  onSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item?: ActionItem | null;
  participants: string[];
  onSubmit: (values: TaskValues) => void;
  saving?: boolean;
}) {
  const [values, setValues] = useState<TaskValues>({ task: "", assignedTo: "", deadline: "" });
  const [error, setError] = useState("");

  // Re-initialise every time the dialog opens (state is otherwise preserved by Activity).
  useEffect(() => {
    if (!open) return;
    setValues({
      task: item?.task ?? "",
      assignedTo: item?.assignedTo ?? "",
      deadline: item?.deadline ? item.deadline.slice(0, 10) : "",
    });
    setError("");
  }, [open, item]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.task.trim()) {
      setError("Describe the task");
      return;
    }
    onSubmit({ ...values, task: values.task.trim(), assignedTo: values.assignedTo.trim() });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={item ? "Edit task" : "Add task"}
      description={item?.deadlineText ? `Mentioned in the meeting as “${item.deadlineText}”.` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="task-form" loading={saving}>
            {item ? "Save changes" : "Add task"}
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Task" error={error}>
          {(p) => (
            <Input
              {...p}
              autoFocus
              value={values.task}
              onChange={(e) => {
                setValues((v) => ({ ...v, task: e.target.value }));
                setError("");
              }}
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Owner" hint="Optional">
            {(p) => (
              <>
                <Input
                  {...p}
                  list="participants-list"
                  value={values.assignedTo}
                  onChange={(e) => setValues((v) => ({ ...v, assignedTo: e.target.value }))}
                />
                <datalist id="participants-list">
                  {participants.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Deadline" hint="Optional">
            {(p) => (
              <Input {...p} type="date" value={values.deadline} onChange={(e) => setValues((v) => ({ ...v, deadline: e.target.value }))} />
            )}
          </Field>
        </div>
      </form>
    </Dialog>
  );
}
