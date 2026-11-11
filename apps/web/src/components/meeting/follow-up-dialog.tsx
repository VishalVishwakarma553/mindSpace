"use client";

import { useQuery } from "@tanstack/react-query";
import { Copy, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonStyles } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/api";

export function FollowUpDialog({ open, onOpenChange, meetingId }: { open: boolean; onOpenChange: (o: boolean) => void; meetingId: string }) {
  const email = useQuery({
    queryKey: ["follow-up", meetingId],
    queryFn: () => api.get<{ subject: string; body: string }>(`/meetings/${meetingId}/follow-up`),
    enabled: open,
  });

  const mailto = email.data
    ? `mailto:?subject=${encodeURIComponent(email.data.subject)}&body=${encodeURIComponent(email.data.body)}`
    : "#";

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Follow-up email"
      description="Drafted only from your meeting notes. Review before sending."
      className="max-w-2xl"
      footer={
        <>
          <Button
            disabled={!email.data}
            onClick={async () => {
              if (!email.data) return;
              await navigator.clipboard.writeText(`Subject: ${email.data.subject}\n\n${email.data.body}`);
              toast.success("Email copied");
            }}
          >
            <Copy className="size-4" aria-hidden /> Copy
          </Button>
          <a href={mailto} className={buttonStyles({ variant: "primary" })} aria-disabled={!email.data}>
            <Mail className="size-4" aria-hidden /> Open in mail app
          </a>
        </>
      }
    >
      {email.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : email.data ? (
        <div>
          <p className="text-sm text-fg-subtle">Subject</p>
          <p className="mt-1 text-[15px] font-medium text-fg">{email.data.subject}</p>
          <pre className="mt-4 rounded-xl border border-border bg-surface-2 p-4 font-sans text-sm leading-6 whitespace-pre-wrap text-fg-muted">
            {email.data.body}
          </pre>
        </div>
      ) : (
        <p className="text-sm text-danger">Could not draft the email.</p>
      )}
    </Dialog>
  );
}
