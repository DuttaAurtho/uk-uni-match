"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../../lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
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
      await api.post("/auth/signup", { email, password });
      router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-1">
        Create your account
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        Save favorites, track your applications, and chat with our team.
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

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="focus-gold w-full text-sm border border-border rounded-md px-3 py-2.5 bg-white"
          />
          <p className="text-xs text-text-muted mt-1">At least 8 characters.</p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full text-sm font-semibold bg-gold hover:bg-gold-light text-navy px-4 py-2.5 rounded-md transition-colors disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Sign up"}
        </button>
      </form>

      <p className="text-sm text-text-secondary mt-6 text-center">
        Already have an account?{" "}
        <Link href="/login" className="text-gold-dark hover:underline font-medium">
          Log in
        </Link>
      </p>
    </>
  );
}
