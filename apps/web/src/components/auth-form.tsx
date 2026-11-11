"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api";
import { keys } from "@/lib/queries";
import type { User } from "@/lib/types";

type Mode = "login" | "register";

/** Only allow in-app relative redirects (prevents open redirects via ?next=). */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const nextErrors: Record<string, string> = {};
    if (mode === "register" && !values.name.trim()) nextErrors.name = "Enter your name";
    if (!/^\S+@\S+\.\S+$/.test(values.email)) nextErrors.email = "Enter a valid email address";
    if (values.password.length < 8) nextErrors.password = "Use at least 8 characters";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      const body = mode === "register" ? values : { email: values.email, password: values.password };
      const { user } = await api.post<{ user: User }>(`/auth/${mode}`, body);
      qc.setQueryData(keys.me, user);
      router.replace(safeNext(params.get("next")));
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        setErrors(Object.fromEntries(Object.entries(err.details).map(([k, v]) => [k, v?.[0]])));
      }
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === "login";
  return (
    <div>
      <div className="mb-8 flex items-center gap-2.5 text-fg lg:hidden">
        <Logo className="size-7" />
        <span className="text-lg font-medium">MeetMind</span>
      </div>
      <h1 className="text-[28px] font-medium tracking-tight text-fg">{isLogin ? "Welcome back" : "Create your account"}</h1>
      <p className="mt-2 text-sm text-fg-subtle">
        {isLogin ? "Sign in to see your meetings and notes." : "Start capturing meetings in minutes."}
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-4">
        {formError && (
          <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
            {formError}
          </p>
        )}
        {!isLogin && (
          <Field label="Name" error={errors.name}>
            {(p) => <Input {...p} autoComplete="name" value={values.name} onChange={set("name")} />}
          </Field>
        )}
        <Field label="Email" error={errors.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" value={values.email} onChange={set("email")} />}
        </Field>
        <Field label="Password" error={errors.password} hint={isLogin ? undefined : "At least 8 characters."}>
          {(p) => (
            <div className="relative">
              <Input
                {...p}
                type={showPassword ? "text" : "password"}
                autoComplete={isLogin ? "current-password" : "new-password"}
                value={values.password}
                onChange={set("password")}
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute top-1/2 right-1 inline-flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-fg-subtle hover:text-fg"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          )}
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-2 w-full">
          {isLogin ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-fg-subtle">
        {isLogin ? "New to MeetMind? " : "Already have an account? "}
        <Link href={isLogin ? "/register" : "/login"} className="font-medium text-fg underline-offset-4 hover:underline">
          {isLogin ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </div>
  );
}
