"use client";

import type { ReactNode } from "react";
import { NeonAuthUIProvider } from "@neondatabase/auth-ui";
import { neon } from "@/lib/neon";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NeonAuthUIProvider authClient={neon.auth} redirectTo="/contacts" emailOTP={false}>
      {children}
    </NeonAuthUIProvider>
  );
}
