"use client";

// The /admin sign-in screen: username (for the browser's password manager) +
// password with a show/hide eye, submitted to /api/admin/login by the parent.

import { useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { ACCENT, BLUE, btn, input, label } from "../ui";

export default function LoginCard({
  error,
  signingIn,
  onSubmit,
}: {
  error: string;
  signingIn: boolean;
  onSubmit: (password: string) => void;
}) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main
      className="grid min-h-dvh place-items-center px-6 py-10 text-neutral-900"
      style={{ background: "radial-gradient(120% 100% at 50% 0%, #ffffff 0%, #eef2fb 45%, #dbe3f4 100%)" }}
    >
      <div className="admin-pop w-full max-w-sm rounded-[2rem] border border-white/70 bg-white/80 p-7 shadow-[0_30px_80px_-30px_rgba(0,32,156,0.35)] backdrop-blur-xl sm:p-8">
        <div className="flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: BLUE + "12" }}>
            <Logo size={30} color="#0b0d12" accent={ACCENT} />
          </span>
          <h1 className="mt-4 font-josefin text-2xl font-light tracking-tight">
            Apex<span style={{ color: ACCENT }}>Ride</span> Admin
          </h1>
          <p className="mt-1 text-xs text-neutral-500">Sign in to manage bookings, prices &amp; options.</p>
        </div>

        <form
          className="mt-6 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(password);
            setPassword("");
          }}
        >
          <div>
            <label className={label} htmlFor="admin-username">Username</label>
            <input
              id="admin-username"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={input}
              placeholder="admin"
            />
          </div>

          <div>
            <label className={label} htmlFor="admin-password">Password</label>
            <div className="relative">
              <input
                id="admin-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                // Once the eye shows it as text, phone keyboards would otherwise
                // capitalise / autocorrect it ("password" → "Password").
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${input} pr-11`}
                placeholder="Your admin password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center text-neutral-400 transition-colors hover:text-neutral-700"
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}

          <button type="submit" disabled={signingIn} className={`${btn} mt-1 w-full`} style={{ background: BLUE }}>
            {signingIn ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-3 text-center text-[11px] leading-relaxed text-neutral-400">
          Your browser will offer to save this login so you won&apos;t have to type it next time.
        </p>
        <Link href="/" className="mt-4 block text-center text-xs text-neutral-400 transition-colors hover:text-neutral-700">
          ← Back to the site
        </Link>
      </div>
    </main>
  );
}
