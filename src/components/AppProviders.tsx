"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export default function AppProviders({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) {
    // No Privy App ID configured yet (e.g. running before Vercel env vars
    // are set) — render children without auth rather than crashing the
    // whole app, so the site still works while Phase 1 setup is in progress.
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Embedded wallets only — no external wallet connect options, per
        // the "no other wallets may sign up" requirement. Users log in with
        // email; Privy creates a hidden wallet behind the scenes.
        loginMethods: ["email"],
        appearance: {
          theme: "light",
          accentColor: "#A6822F",
          logo: undefined,
        },
        embeddedWallets: {
          // Only Ethereum is auto-provisioned today. Privy's current React
          // SDK (v3.46) does not expose a `bitcoin` key under
          // embeddedWallets' createOnLogin config the way it does for
          // ethereum/solana — Bitcoin wallet creation needs its own
          // investigation when Phase 3 (on-chain records) is built, per
          // the earlier flagged due-diligence item.
          ethereum: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
