"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";

type AuthMode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function checkSession() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (active) {
          setCurrentUserEmail(user?.email ?? null);
        }
      } catch {
        // Ignore when env vars are not yet configured locally
      }
    }
    checkSession();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMsg("Please enter both your email address and password.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) {
          setErrorMsg(error.message);
          setLoading(false);
          return;
        }
        router.push("/today");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        });
        if (error) {
          setErrorMsg(error.message);
          setLoading(false);
          return;
        }
        if (data.session) {
          router.push("/today");
          router.refresh();
        } else {
          setStatusMsg(
            "Account created. If email confirmation is enabled in Supabase, check your inbox; otherwise you can sign in now."
          );
          setMode("signin");
          setLoading(false);
        }
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Authentication failed. Check your connection and try again."
      );
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F1E8] text-[#191919]">
      <SiteHeader userEmail={currentUserEmail} showSignOut={true} />

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-12 sm:px-8">
        <div className="border-t-2 border-b border-[#191919] py-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A84432]">
            Subscriber Desk
          </p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            {mode === "signin"
              ? "Sign in to Your Morning Paper"
              : "Start Your Morning Paper"}
          </h1>
          <p className="mt-1 text-sm text-[#4A4742]">
            One finite daily edition, edited for your interests.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Authentication mode"
          className="mt-8 grid grid-cols-2 border border-[#D6CFC1] bg-[#EFEADD] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            onClick={() => {
              setMode("signin");
              setErrorMsg(null);
              setStatusMsg(null);
            }}
            className={`py-2 text-xs font-semibold uppercase tracking-wider transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A84432] ${
              mode === "signin"
                ? "bg-[#191919] text-[#F5F1E8]"
                : "text-[#191919] hover:text-[#A84432]"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            onClick={() => {
              setMode("signup");
              setErrorMsg(null);
              setStatusMsg(null);
            }}
            className={`py-2 text-xs font-semibold uppercase tracking-wider transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A84432] ${
              mode === "signup"
                ? "bg-[#191919] text-[#F5F1E8]"
                : "text-[#191919] hover:text-[#A84432]"
            }`}
          >
            Create Account
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-6 space-y-5 border border-[#D6CFC1] bg-[#F5F1E8] p-6 sm:p-8"
        >
          {errorMsg && (
            <div
              role="alert"
              aria-live="assertive"
              className="border-l-4 border-[#A84432] bg-[#EFEADD] p-3 text-sm text-[#191919]"
            >
              <p className="font-semibold text-[#A84432]">
                Unable to authenticate
              </p>
              <p className="mt-0.5">{errorMsg}</p>
            </div>
          )}

          {statusMsg && (
            <div
              role="status"
              aria-live="polite"
              className="border-l-4 border-[#191919] bg-[#EFEADD] p-3 text-sm text-[#191919]"
            >
              <p className="font-semibold">Notice</p>
              <p className="mt-0.5">{statusMsg}</p>
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider text-[#191919]"
            >
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="reader@example.com"
              className="mt-2 w-full border border-[#191919] bg-[#F5F1E8] px-3.5 py-2.5 text-sm text-[#191919] placeholder:text-[#4A4742]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A84432]"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-[#191919]"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="mt-2 w-full border border-[#191919] bg-[#F5F1E8] px-3.5 py-2.5 text-sm text-[#191919] placeholder:text-[#4A4742]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A84432]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full border border-[#191919] bg-[#191919] px-5 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#F5F1E8] transition-colors hover:bg-[#A84432] hover:border-[#A84432] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A84432] disabled:opacity-50"
          >
            {loading
              ? mode === "signin"
                ? "Signing in…"
                : "Creating account…"
              : mode === "signin"
                ? "Sign in to Daybreak"
                : "Create Daybreak Account"}
          </button>
        </form>
      </main>
    </div>
  );
}
