import { fr } from "@codegouvfr/react-dsfr";

const LOGOUT_PATH = "/api/auth/proconnect-logout";

// A native anchor triggers a document navigation. next/link would fetch this
// route, and the cross-origin redirect to ProConnect is blocked by connect-src.
export function LogoutLink({ id }: { id?: string }) {
  return (
    <a id={id} className={fr.cx("fr-btn", "fr-icon-logout-box-r-line")} href={LOGOUT_PATH}>
      Se déconnecter
    </a>
  );
}
