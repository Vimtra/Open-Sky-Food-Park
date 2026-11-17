"use client";

import { useState } from "react";
import { backend, formatPhone, isDemo, normalizePhone } from "@/lib/backend";
import { friendlyError } from "@/lib/format";
import { Button, Field, inputClass, Notice } from "./ui";

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
