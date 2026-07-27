"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import { api, ApiError } from "../../lib/api";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await api.post("/auth/login", { email, password });
      await refresh();
      router.push(data.user.role === "admin" ? "/admin" : params.get("next") || "/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-1">
        Welcome back
      </h1>
      <p className="text-sm text-text-secondary mb-6">Log in to your UK Uni Match account.</p>

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
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-text-primary">Password</label>
            <Link href="/forgot-password" className="text-xs text-gold-dark hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="focus-gold w-full text-sm border border-border rounded-md px-3 py-2.5 bg-white"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full text-sm font-semibold bg-gold hover:bg-gold-light text-navy px-4 py-2.5 rounded-md transition-colors disabled:opacity-50"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="text-sm text-text-secondary mt-6 text-center">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-gold-dark hover:underline font-medium">
          Sign up
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
