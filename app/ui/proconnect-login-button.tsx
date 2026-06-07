"use client";

import { ProConnectButton } from "@codegouvfr/react-dsfr/ProConnectButton";
import { signIn } from "@/app/lib/auth-client";

// Bouton ProConnect : déclenche le flux OAuth2/OIDC du provider "proconnect"
// configuré dans app/lib/auth.ts. Après connexion, redirection vers /case_files.
export function ProConnectLoginButton() {
  return (
    <ProConnectButton
      onClick={() =>
        signIn.oauth2({
          providerId: "proconnect",
          callbackURL: "/case_files",
        })
      }
    />
  );
}
