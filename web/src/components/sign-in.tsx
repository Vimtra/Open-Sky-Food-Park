"use client";

import { useState } from "react";
import { backend, formatPhone, isDemo, normalizePhone, signInMethods, type Area } from "@/lib/backend";
import { friendlyError } from "@/lib/format";
import { Button, cn, Field, inputClass, Notice } from "./ui";

/** Google's four-colour "G", as Google's sign-in branding guidelines ask for on this button. */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z" />
    </svg>
  );
}

/** "Continue with Google". Leaves the page for Google, then returns to `returnTo` signed in. */
export function GoogleSignInButton({ area, returnTo, onDone, className }: { area: Area; returnTo: string; onDone?: () => void; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={className}>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await backend().signInWithGoogle(area, returnTo);
            onDone?.();
          } catch (err) {
            setError(friendlyError(err));
          } finally {
            // With Supabase the page navigates away; this only matters for demo mode and errors.
            setBusy(false);
          }
        }}
        className={cn(
          "flex h-13 w-full items-center justify-center gap-3 rounded-md border border-line-strong bg-white text-body font-bold text-ink-900",
          "transition-colors duration-150 hover:bg-surface-1 active:bg-surface-2 disabled:text-ink-500",
        )}
      >
        <GoogleMark className="size-5" />
        {busy ? "Opening Google…" : "Continue with Google"}
      </button>
      {isDemo && <p className="mt-1.5 text-small text-ink-500">Demo: signs you in as a sample Google user. Nothing is sent to Google.</p>}
      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}
    </div>
  );
}

/** Every customer sign-in option this deployment offers (see NEXT_PUBLIC_SIGNIN_METHODS). */
export function CustomerSignIn({ returnTo, onDone }: { returnTo: string; onDone?: () => void }) {
  const google = signInMethods.includes("google");
  const phone = signInMethods.includes("phone");
  return (
    <div>
      {google && <GoogleSignInButton area="customer" returnTo={returnTo} onDone={onDone} />}
      {google && phone && (
        <div className="my-6 flex items-center gap-3 text-small font-semibold text-ink-500" role="separator">
          <span className="h-px flex-1 bg-line" />
          or use your mobile number
          <span className="h-px flex-1 bg-line" />
        </div>
      )}
      {phone && <PhoneSignIn onDone={onDone} />}
    </div>
  );
}

/** Phone number, then a 6-digit code. Calls `onDone` once the customer is signed in. */
export function PhoneSignIn({ onDone }: { onDone?: () => void }) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const normalized = normalizePhone(phoneInput);
    if (!normalized) {
      setError("Enter a 10-digit mobile number, like (408) 555-0123.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await backend().requestOtp(normalized);
      setPhone(normalized);
      setCode("");
      setStep("code");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from the text message.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await backend().verifyOtp(phone, code);
      onDone?.();
    } catch (err) {
      setError(friendlyError(err) || "That code did not work. Check it and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (step === "phone") {
    return (
      <form onSubmit={sendCode} className="space-y-4" noValidate>
        <Field label="Mobile number" htmlFor="phone" hint="We text you a 6-digit code. Your orders are saved to this number." error={error}>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            autoFocus
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="(408) 555-0123"
            className={inputClass}
            aria-invalid={Boolean(error)}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Text me a code
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4" noValidate>
      {isDemo && <Notice tone="warn">Demo mode: no text is sent. Enter any 6 digits.</Notice>}
      <Field label={`Code sent to ${formatPhone(phone)}`} htmlFor="otp" error={error}>
        <input
          id="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="6-digit code"
          className={`${inputClass} text-center text-heading tracking-[0.4em] tabular-nums placeholder:text-body placeholder:font-normal placeholder:tracking-normal`}
          aria-invalid={Boolean(error)}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        Verify and continue
      </Button>
      <div className="flex justify-between text-label">
        <button type="button" className="font-bold text-ember-700 hover:underline" onClick={() => setStep("phone")}>
          Change number
        </button>
        <button type="button" className="font-bold text-ember-700 hover:underline disabled:text-ink-500" disabled={busy} onClick={() => sendCode()}>
          Send a new code
        </button>
      </div>
    </form>
  );
}
