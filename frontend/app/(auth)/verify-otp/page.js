"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import { api } from "../../lib/api";

function VerifyOtpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const email = params.get("email") || "";
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await api.post("/auth/verify-otp", { email, code });
      await refresh();
      router.push(data.user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError("");
    setInfo("");
    setResending(true);
    try {
      await api.post("/auth/resend-otp", { email, purpose: "verify_email" });
      setInfo("A new code has been sent.");
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-1">
        Verify your email
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        We sent a 6-digit code to <span className="font-medium text-text-primary">{email}</span>.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-danger bg-danger-bg rounded-md px-3 py-2">{error}</p>}
        {info && <p className="text-sm text-success bg-success-bg rounded-md px-3 py-2">{info}</p>}

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Verification code</label>
          <input
            type="text"
            inputMode="numeric"
            required
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="focus-gold w-full text-lg tracking-[0.4em] text-center font-[family-name:var(--font-mono)] border border-border rounded-md px-3 py-2.5 bg-white"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || code.length !== 6}
          className="w-full text-sm font-semibold bg-gold hover:bg-gold-light text-navy px-4 py-2.5 rounded-md transition-colors disabled:opacity-50"
        >
          {submitting ? "Verifying…" : "Verify"}
        </button>
      </form>

      <button
        onClick={handleResend}
        disabled={resending}
        className="w-full text-sm text-gold-dark hover:underline mt-4 disabled:opacity-50"
      >
        {resending ? "Sending…" : "Resend code"}
      </button>
    </>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense>
      <VerifyOtpForm />
    </Suspense>
  );
}
