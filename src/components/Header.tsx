"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@neondatabase/auth-ui";

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-4 sm:px-6">
      <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-900">
        Networking Tracker
      </Link>
      <div className="flex items-center gap-3">
        <SignedIn>
          <Link
            href="/contacts"
            className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-900 sm:inline"
          >
            My contacts
          </Link>
          <UserButton size="icon" />
        </SignedIn>
        <SignedOut>
          <Link
            href="/auth/sign-in"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            Sign in
          </Link>
          <Link
            href="/auth/sign-up"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Sign up
          </Link>
        </SignedOut>
      </div>
    </header>
  );
}
