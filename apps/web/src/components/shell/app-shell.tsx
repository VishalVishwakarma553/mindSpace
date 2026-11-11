"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCircle2,
  Files,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Plug,
  Search,
  Settings,
  UserRound,
  Video,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Kbd, Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { useMe } from "@/lib/queries";
import { RealtimeProvider, useRealtime } from "@/lib/realtime";
import { BreadcrumbProvider, Breadcrumbs } from "./breadcrumbs";
import { Logo } from "./logo";
import { RecordDialog } from "./record-dialog";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, match: (p: string) => p === "/" },
  { href: "/meetings", label: "Meetings", icon: Files, match: (p: string) => p.startsWith("/meetings") },
  { href: "/tasks", label: "Tasks", icon: ListChecks, match: (p: string) => p.startsWith("/tasks") },
  { href: "/search", label: "Search", icon: Search, match: (p: string) => p.startsWith("/search") },
  { href: "/setup", label: "Setup", icon: Plug, match: (p: string) => p.startsWith("/setup") },
];

function RailLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Files; active: boolean }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <Link
          href={href}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          className={cn(
            "relative inline-flex size-11 items-center justify-center rounded-xl transition-colors duration-150",
            active ? "bg-surface-3 text-fg" : "text-fg-subtle hover:bg-surface-2 hover:text-fg",
          )}
        >
          {active && <span aria-hidden className="absolute top-2.5 bottom-2.5 -left-[13px] w-[3px] rounded-r bg-fg" />}
          <Icon className="size-5" aria-hidden />
        </Link>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="right" sideOffset={10} className="z-50 rounded-md border border-border-strong bg-surface-2 px-2 py-1 text-xs text-fg">
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function GlobalSearch() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");

  // "/" focuses search from anywhere (keyboard shortcut, not overriding typing in fields).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) && !target.isContentEditable) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      role="search"
      className="relative hidden w-full max-w-[420px] lg:block"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim().length >= 2) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-fg-subtle" aria-hidden />
      <label htmlFor="global-search" className="sr-only">
        Search transcripts, tasks, or meetings
      </label>
      <input
        ref={ref}
        id="global-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search transcripts, tasks, or files..."
        className="h-12 w-full rounded-xl border border-border bg-surface pr-12 pl-11 text-sm text-fg placeholder:text-fg-subtle transition-colors hover:border-border-strong focus:border-accent focus:outline-none"
      />
      <span className="absolute top-1/2 right-3.5 -translate-y-1/2">
        <Kbd>/</Kbd>
      </span>
    </form>
  );
}

function Notifications() {
  const { notifications, markAllRead, connected } = useRealtime();
  const unread = notifications.filter((n) => !n.read).length;
  return (
    <Menu onOpenChange={(open) => !open && markAllRead()}>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative inline-flex size-12 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
        >
          <Bell className="size-5" aria-hidden />
          {unread > 0 && <span aria-hidden className="absolute top-3 right-3.5 size-2 rounded-full bg-rec ring-2 ring-surface" />}
        </button>
      </MenuTrigger>
      <MenuContent className="w-80">
        <MenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <span className="flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full", connected ? "bg-success" : "bg-fg-subtle")} aria-hidden />
            {connected ? "Live" : "Offline"}
          </span>
        </MenuLabel>
        {notifications.length === 0 ? (
          <p className="px-2.5 py-6 text-center text-sm text-fg-subtle">You&apos;ll be notified when meeting notes are ready.</p>
        ) : (
          notifications.map((n) => (
            <MenuItem key={n.id} asChild className="h-auto items-start py-2">
              <Link href={`/meetings/${n.meetingId}`}>
                {n.kind === "error" ? (
                  <XCircle className="mt-0.5 shrink-0 text-danger" aria-hidden />
                ) : (
                  <CheckCircle2 className="mt-0.5 shrink-0 text-success" aria-hidden />
                )}
                <span className="min-w-0">
                  <span className="block text-sm text-fg">{n.title}</span>
                  <span className="block truncate text-xs text-fg-subtle">{n.description}</span>
                  <span className="block text-xs text-fg-subtle">{relativeTime(new Date(n.at))}</span>
                </span>
              </Link>
            </MenuItem>
          ))
        )}
      </MenuContent>
    </Menu>
  );
}

function AccountMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <UserRound className="size-5" aria-hidden />
        </button>
      </MenuTrigger>
      <MenuContent side="right" align="end">
        <MenuLabel>
          <span className="block text-sm text-fg">{name}</span>
          <span className="block">{email}</span>
        </MenuLabel>
        <MenuSeparator />
        <MenuItem asChild>
          <Link href="/settings">
            <Settings aria-hidden /> Settings
          </Link>
        </MenuItem>
        <MenuItem
          onSelect={async () => {
            await api.post("/auth/logout");
            qc.clear();
            router.replace("/login");
          }}
        >
          <LogOut aria-hidden /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const me = useMe();
  const [recordOpen, setRecordOpen] = useState(false);

  useEffect(() => {
    if (!me.isError) return;
    // Clear the stale cookie first, otherwise the proxy would bounce /login back to /.
    void api
      .post("/auth/logout")
      .catch(() => undefined)
      .finally(() => router.replace(`/login?next=${encodeURIComponent(pathname)}`));
  }, [me.isError, pathname, router]);

  return (
    <RealtimeProvider enabled={me.isSuccess}>
      <BreadcrumbProvider>
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-cta px-4 py-2 text-cta-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <div className="flex h-dvh overflow-hidden bg-bg">
          {/* Icon rail */}
          <aside className="hidden w-[76px] shrink-0 flex-col items-center border-r border-border py-4 md:flex">
            <Link href="/" aria-label="MeetMind home" className="mb-7 inline-flex size-11 items-center justify-center text-fg">
              <Logo className="size-8" />
            </Link>
            <nav aria-label="Primary" className="flex flex-col items-center gap-2">
              {NAV.map((item) => (
                <RailLink key={item.href} {...item} active={item.match(pathname)} />
              ))}
            </nav>
            <div className="mt-auto flex flex-col items-center gap-2">
              <RailLink href="/settings" label="Settings" icon={Settings} active={pathname.startsWith("/settings")} />
              {me.data && <AccountMenu name={me.data.name} email={me.data.email} />}
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Top bar */}
            <header className="flex h-[76px] shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
              <Link href="/" aria-label="MeetMind home" className="text-fg md:hidden">
                <Logo className="size-7" />
              </Link>
              <div className="min-w-0 flex-1">
                <Breadcrumbs />
              </div>
              <GlobalSearch />
              <Link
                href="/search"
                aria-label="Search"
                className="inline-flex size-12 items-center justify-center rounded-xl border border-border bg-surface text-fg-muted lg:hidden"
              >
                <Search className="size-5" aria-hidden />
              </Link>
              <Notifications />
              <Button variant="primary" size="lg" onClick={() => setRecordOpen(true)} className="px-3 sm:px-5">
                <Video className="size-5" aria-hidden />
                <span className="hidden sm:inline">Record a Meeting</span>
              </Button>
            </header>

            <main id="main" className="min-h-0 flex-1 overflow-y-auto pb-20 md:pb-0">
              {me.isPending ? (
                <div className="space-y-4 p-6">
                  <Skeleton className="h-8 w-64" />
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : me.isSuccess ? (
                children
              ) : null}
            </main>
          </div>
        </div>

        {/* Mobile bottom navigation */}
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          {[...NAV.slice(0, 4), { href: "/settings", label: "Settings", icon: Settings, match: (p: string) => p.startsWith("/settings") }].map(
            ({ href, label, icon: Icon, match }) => (
              <Link
                key={href}
                href={href}
                aria-current={match(pathname) ? "page" : undefined}
                className={cn(
                  "flex min-w-14 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[11px]",
                  match(pathname) ? "text-fg" : "text-fg-subtle",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            ),
          )}
        </nav>

        <RecordDialog open={recordOpen} onOpenChange={setRecordOpen} />
      </BreadcrumbProvider>
    </RealtimeProvider>
  );
}
