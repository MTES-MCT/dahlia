"use client";

import { fr } from "@codegouvfr/react-dsfr";
import Link from "next/link";
import type { MouseEvent } from "react";

const LOGOUT_PATH = "/api/auth/proconnect-logout";

// next/link navigates with fetch. This route redirects cross-origin to
// ProConnect, and that fetch is blocked by connect-src. A document load
// lets the browser follow the redirect.
export function LogoutLink({ id }: { id?: string }) {
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    window.location.assign(LOGOUT_PATH);
  }

  return (
    <Link
      id={id}
      className={fr.cx("fr-btn", "fr-icon-logout-box-r-line")}
      href={LOGOUT_PATH}
      prefetch={false}
      onClick={onClick}
    >
      Se déconnecter
    </Link>
  );
}
