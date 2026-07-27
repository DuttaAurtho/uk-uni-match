"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../../lib/api";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { email });
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-1">
        Reset your password
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        Enter your email and we&apos;ll send you a code to reset your password.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-danger bg-danger-bg rounded-md px-3 py-2">{error}</p>}

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="focus-gold w-full text-sm border border-border rounded-md px-3 py-2.5 bg-white"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full text-sm font-semibold bg-gold hover:bg-gold-light text-navy px-4 py-2.5 rounded-md transition-colors disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Send reset code"}
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
