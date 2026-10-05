"use client";

import { ProConnectButton } from "@codegouvfr/react-dsfr/ProConnectButton";
import { signIn } from "@/app/lib/auth-client";

// Starts the ProConnect OIDC flow configured in app/lib/auth.ts.
// After sign-in, Better Auth redirects to /case_files.
export function ProConnectLoginButton() {
  return (
    <ProConnectButton
      onClick={() =>
        signIn.social({
          provider: "proconnect",
          callbackURL: "/case_files",
        })
      }
    />
  );
}
