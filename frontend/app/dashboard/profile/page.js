"use client";

import { useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import { api, avatarUrl } from "../../lib/api";
import { IconShuffle } from "../../components/icons";

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [seedInput, setSeedInput] = useState("");
  const [avatarError, setAvatarError] = useState("");

  const [step, setStep] = useState("idle"); // idle | code-sent
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwInfo, setPwInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleShuffle() {
    setAvatarError("");
    try {
      await api.post("/me/avatar/shuffle");
      await refresh();
    } catch (err) {
      setAvatarError(err.message);
    }
  }

  async function handleSetSeed(e) {
    e.preventDefault();
    if (!seedInput.trim()) return;
    setAvatarError("");
    try {
      await api.post("/me/avatar", { seed: seedInput.trim() });
      await refresh();
      setSeedInput("");
    } catch (err) {
      setAvatarError(err.message);
    }
  }

  async function handleSendCode() {
    setPwError("");
    setPwInfo("");
    setSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { email: user.email });
      setStep("code-sent");
      setPwInfo(`A verification code was sent to ${user.email}.`);
    } catch (err) {
      setPwError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwError("");
    if (newPassword.length < 8) {
      setPwError("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { email: user.email, code, new_password: newPassword });
      setPwInfo("Password updated.");
      setStep("idle");
      setCode("");
      setNewPassword("");
    } catch (err) {
      setPwError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary mb-1">
          Profile
        </h1>
        <p className="text-sm text-text-secondary">{user?.email}</p>
      </div>

      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="font-medium text-text-primary mb-4">Avatar</h2>
        {avatarError && <p className="text-sm text-danger bg-danger-bg rounded-md px-3 py-2 mb-3">{avatarError}</p>}
        <div className="flex items-center gap-4">
          <img
            src={avatarUrl(user?.avatar_seed)}
            alt=""
            className="w-16 h-16 rounded-full bg-background border border-border"
          />
          <button
            onClick={handleShuffle}
            className="inline-flex items-center gap-1.5 text-sm font-medium border border-border rounded-md px-3 py-2 hover:bg-background transition-colors"
          >
            <IconShuffle width={15} height={15} />
            Shuffle
          </button>
        </div>
        <form onSubmit={handleSetSeed} className="flex gap-2 mt-4">
          <input
            type="text"
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            placeholder="Or type a custom seed…"
            maxLength={64}
            className="focus-gold flex-1 text-sm border border-border rounded-md px-3 py-2 bg-white"
          />
          <button
            type="submit"
            className="shrink-0 text-sm font-medium border border-border rounded-md px-3 py-2 hover:bg-background transition-colors"
          >
            Set
          </button>
        </form>
      </section>

      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="font-medium text-text-primary mb-4">Change password</h2>
        {pwError && <p className="text-sm text-danger bg-danger-bg rounded-md px-3 py-2 mb-3">{pwError}</p>}
        {pwInfo && <p className="text-sm text-success bg-success-bg rounded-md px-3 py-2 mb-3">{pwInfo}</p>}

        {step === "idle" ? (
          <button
            onClick={handleSendCode}
            disabled={submitting}
            className="text-sm font-semibold bg-gold hover:bg-gold-light text-navy px-4 py-2.5 rounded-md transition-colors disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send verification code"}
          </button>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Verification code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="focus-gold w-full text-lg tracking-[0.4em] text-center font-[family-name:var(--font-mono)] border border-border rounded-md px-3 py-2.5 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">New password</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
        )}
      </section>
    </div>
  );
}
