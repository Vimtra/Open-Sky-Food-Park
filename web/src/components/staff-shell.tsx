"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { useState, type ReactNode } from "react";
import { backend, isDemo } from "@/lib/backend";
import { friendlyError, imageSrc } from "@/lib/format";
import { useCatalog } from "@/lib/hooks";
import type { Session } from "@/lib/types";
import { OpenSkyLogo } from "./brand/open-sky-logo";
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

/** Sign-in for stall staff and admins. Demo mode offers one-tap entry instead of credentials. */
export function StaffSignIn({ want }: { want: "stall_staff" | "admin" }) {
  const { index } = useCatalog();
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

  if (isDemo) {
    return (
      <Container className="max-w-md py-10">
        <h1 className="text-title">{want === "admin" ? "Admin panel" : "Stall dashboard"}</h1>
        <p className="mt-2 text-ink-700">
          Demo mode: no password needed. {want === "admin" ? "Step in as the park admin." : "Pick the stall you want to run."}
        </p>
        {error && (
          <Notice tone="error" className="mt-4">
            {error}
          </Notice>
        )}
        {want === "admin" ? (
          <Button size="lg" className="mt-6 w-full" loading={busy === "admin"} onClick={() => run("admin", () => backend().demoStaffSignIn("admin"))}>
            Continue as park admin
          </Button>
        ) : (
          <ul className="mt-6 space-y-3">
            {index?.stalls.map((stall) => (
              <li key={stall.id}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run(stall.id, () => backend().demoStaffSignIn("stall_staff", stall.id))}
                  className="flex w-full items-center gap-3 rounded-lg border border-line p-3 text-left transition-colors duration-150 hover:bg-surface-1"
                >
                  {stall.logo_url && <img src={imageSrc(stall.logo_url)!} alt="" className="size-12 rounded-full border border-line bg-white object-cover" />}
                  <span className="flex-1 font-bold">{stall.name}</span>
                  <span className="text-label font-bold text-ember-700">{busy === stall.id ? "Opening…" : "Open"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Container>
    );
  }

  return (
    <Container className="max-w-md py-10">
      <h1 className="text-title">{want === "admin" ? "Admin sign in" : "Stall sign in"}</h1>
      <p className="mt-2 text-ink-700">Use the email and password the park gave you.</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run("password", () => backend().signInWithPassword(email.trim(), password));
        }}
      >
        <Field label="Email" htmlFor="staff-email">
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
    </Container>
  );
}
