"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface SiteHeaderProps {
  userEmail?: string | null;
  showSignOut?: boolean;
}

export function SiteHeader({
  userEmail,
  showSignOut = true,
}: SiteHeaderProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        setSignOutError(error.message);
        setSigningOut(false);
        return;
      }
      router.push("/login");
      router.refresh();
    } catch (err) {
      setSignOutError(
        err instanceof Error ? err.message : "Unable to sign out."
      );
      setSigningOut(false);
    }
  }

  return (
    <header className="w-full border-b border-[#D6CFC1] bg-[#F5F1E8]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-8">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="font-display text-xl font-bold tracking-tight text-[#191919] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A84432]"
          >
            DAYBREAK
          </Link>
          <span
            aria-hidden="true"
            className="hidden text-xs uppercase tracking-widest text-[#4A4742] sm:inline"
          >
            Morning Edition
          </span>
        </div>

        <nav aria-label="Primary navigation" className="flex items-center gap-4">
          <Link
            href="/today"
            className="text-sm font-medium text-[#191919] underline-offset-4 hover:text-[#A84432] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A84432]"
          >
            Today&apos;s Paper
          </Link>
          {userEmail && (
            <span className="hidden text-xs text-[#4A4742] md:inline">
              {userEmail}
            </span>
          )}
          {showSignOut ? (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="border border-[#191919] bg-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#191919] transition-colors hover:bg-[#191919] hover:text-[#F5F1E8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A84432] disabled:opacity-50"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          ) : (
            <Link
              href="/login"
              className="border border-[#191919] px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#191919] transition-colors hover:bg-[#191919] hover:text-[#F5F1E8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A84432]"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
      {signOutError && (
        <div
          role="alert"
          className="border-t border-[#A84432] bg-[#EFEADD] px-4 py-2 text-center text-xs text-[#A84432]"
        >
          Sign-out error: {signOutError}
        </div>
      )}
    </header>
  );
}
