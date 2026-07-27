"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "../../lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") || "";
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { email, code, new_password: password });
      router.push("/login");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-1">
        Set a new password
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        Enter the code sent to <span className="font-medium text-text-primary">{email}</span> and choose a
        new password.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-danger bg-danger-bg rounded-md px-3 py-2">{error}</p>}

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

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">New password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="focus-gold w-full text-sm border border-border rounded-md px-3 py-2.5 bg-white"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || code.length !== 6}
          className="w-full text-sm font-semibold bg-gold hover:bg-gold-light text-navy px-4 py-2.5 rounded-md transition-colors disabled:opacity-50"
        >
          {submitting ? "Updating…" : "Update password"}
        </button>
      </form>

      <p className="text-sm text-text-secondary mt-6 text-center">
        <Link href="/login" className="text-gold-dark hover:underline font-medium">
          Back to login
        </Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
