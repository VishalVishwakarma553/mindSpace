import { FileText, ListChecks, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/shell/logo";

const points = [
  { icon: FileText, title: "Transcripts with timestamps", text: "Every word, searchable and linked to the moment it was said." },
  { icon: ListChecks, title: "Decisions & action items", text: "Grounded in the transcript. No invented owners or deadlines." },
  { icon: ShieldCheck, title: "Local-first & private", text: "Audio and notes stay on your machine with open-source models." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-[1fr_minmax(480px,560px)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border p-12 lg:flex">
        <div className="flex items-center gap-3 text-fg">
          <Logo className="size-8" />
          <span className="text-xl font-medium">MeetMind</span>
        </div>
        <div className="max-w-lg">
          <h1 className="text-[40px] leading-[1.15] font-medium tracking-tight text-fg">
            Stay in the conversation.
            <br />
            <span className="text-fg-subtle">Let AI take the notes.</span>
          </h1>
          <ul className="mt-10 flex flex-col gap-6">
            {points.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface">
                  <p.icon className="size-5 text-fg-muted" aria-hidden />
                </span>
                <div>
                  <p className="text-[15px] font-medium text-fg">{p.title}</p>
                  <p className="mt-0.5 text-sm text-fg-subtle">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-fg-subtle">Open Meet → Start recording → Attend → Stop → View AI notes.</p>
      </aside>
      <main className="flex items-center justify-center px-4 py-12 sm:px-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
