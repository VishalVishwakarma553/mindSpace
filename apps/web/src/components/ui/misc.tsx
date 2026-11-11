import { cn } from "@/lib/cn";
import { initials, speakerColor } from "@/lib/format";

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-[var(--radius-panel)] border border-border bg-surface", className)} {...props} />;
}

type Tone = "neutral" | "amber" | "orange" | "accent" | "teal" | "success" | "danger";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-3 text-fg-muted border-border-strong",
  amber: "bg-amber-soft text-amber border-amber/20",
  orange: "bg-orange-soft text-orange border-orange/20",
  accent: "bg-accent-soft text-accent border-accent/25",
  teal: "bg-teal-soft text-teal border-teal/20",
  success: "bg-success-soft text-success border-success/20",
  danger: "bg-danger-soft text-danger border-danger/25",
};

export function Chip({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Tag colours follow the reference: first tag amber, second orange, the rest neutral. */
export const tagTone = (index: number): Tone => (index === 0 ? "amber" : index === 1 ? "orange" : "neutral");

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-lg", className)} />;
}

export function Avatar({ name, size = 40, className }: { name: string; size?: number; className?: string }) {
  const color = speakerColor(name || "?");
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-medium", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        color,
        background: `color-mix(in srgb, ${color} 14%, var(--surface-2))`,
        border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
      }}
    >
      {initials(name || "?")}
    </span>
  );
}

export function ProgressBar({ value, label, className }: { value: number; label: string; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function SectionTitle({
  icon: Icon,
  children,
  action,
  as: Tag = "h2",
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  action?: React.ReactNode;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <Tag className="flex items-center gap-2.5 text-lg font-medium text-fg">
        {Icon && <Icon className="size-5 text-fg-muted" />}
        {children}
      </Tag>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <span className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl border border-border bg-surface-2">
        <Icon className="size-5.5 text-fg-muted" />
      </span>
      <p className="text-[15px] font-medium text-fg">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm text-fg-subtle">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border-strong bg-surface-3 px-1 text-[11px] font-medium text-fg-subtle">
      {children}
    </kbd>
  );
}
