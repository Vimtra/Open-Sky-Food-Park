"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { useState, type ReactNode } from "react";
import { backend, isDemo } from "@/lib/backend";
import { friendlyError } from "@/lib/format";
import type { Session } from "@/lib/types";
import { OpenSkyLogo } from "./brand/open-sky-logo";
import { GoogleSignInButton } from "./sign-in";
import { Button, Container, Field, inputClass, Notice } from "./ui";

/** Header shared by the stall dashboard and the admin panel. */
export function StaffHeader({ title, session, children }: { title: string; session: Session | null; children?: ReactNode }) {
  return (
    <header className="on-night bg-night-900 text-white">
      <Container className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
        <Link href="/" className="flex items-center gap-4 rounded-md" aria-label="Open Sky Food Park, customer site">
          <OpenSkyLogo variant="compact" className="w-28" title="Open Sky Food Park" />
          <span className="border-l border-white/15 pl-4 text-[1.0625rem] leading-5 font-extrabold tracking-tight">{title}</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {children}
          {session && (
            <button
              type="button"
              onClick={() => backend().signOut("staff")}
              aria-label="Sign out"
              className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-label font-bold text-white hover:bg-white/10"
            >
              <LogOut className="size-4.5" aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          )}
        </div>
      </Container>
    </header>
  );
}

/**
 * Sign-in for stall staff and admins. Each stall has its own login (email + password) that the park
 * admin sets in Admin → Stalls; signing in with it opens only that stall. Demo mode keeps a one-tap
 * entry for the admin panel only.
 */
export function StaffSignIn({ want }: { want: "stall_staff" | "admin" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  };

  if (isDemo && want === "admin") {
    return (
      <Container className="max-w-md py-10">
        <h1 className="text-title">Admin panel</h1>
        <p className="mt-2 text-ink-700">Demo mode: no password needed for the park admin.</p>
        {error && (
          <Notice tone="error" className="mt-4">
            {error}
          </Notice>
        )}
        <Button size="lg" className="mt-6 w-full" loading={busy === "admin"} onClick={() => run("admin", () => backend().demoStaffSignIn("admin"))}>
          Continue as park admin
        </Button>
      </Container>
    );
  }

  const passwordForm = (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run("password", () => backend().signInWithPassword(email.trim(), password));
      }}
    >
      <Field label={want === "admin" ? "Email" : "Stall login email"} htmlFor="staff-email">
        <input id="staff-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Password" htmlFor="staff-password" error={error}>
        <input
          id="staff-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={busy === "password"}>
        Sign in
      </Button>
    </form>
  );

  return (
    <Container className="max-w-md py-10">
      <h1 className="text-title">{want === "admin" ? "Admin sign in" : "Stall sign in"}</h1>
      <p className="mt-2 text-ink-700">
        {want === "admin"
          ? "Use the Google account or the email and password of the park admin."
          : "Use your stall's own login. It opens your stall only: your orders, your menu, your open and closed switch."}
      </p>
      {isDemo ? (
        <>
          <Notice tone="warn" className="mt-5">
            Demo: the park admin sets each stall&apos;s login in Admin → Stalls → Stall login. It works in this browser only.
          </Notice>
          <div className="mt-6">{passwordForm}</div>
        </>
      ) : (
        <>
          <GoogleSignInButton area="staff" returnTo={want === "admin" ? "/admin" : "/partner"} className="mt-6" />
          <div className="my-6 flex items-center gap-3 text-small font-semibold text-ink-500" role="separator">
            <span className="h-px flex-1 bg-line" />
            or with email and password
            <span className="h-px flex-1 bg-line" />
          </div>
          {passwordForm}
        </>
      )}
    </Container>
  );
}
