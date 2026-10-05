import { fr } from "@codegouvfr/react-dsfr";
import { Button } from "@codegouvfr/react-dsfr/Button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Déconnexion",
};

// Landing page for the ProConnect post_logout_redirect_uri. The local session
// is already cleared before the browser is sent to the identity provider.
export default function LogoutPage() {
  return (
    <div className={fr.cx("fr-mx-3w", "fr-py-6w")}>
      <h1>Vous êtes déconnecté</h1>
      <p>Votre session DAHLIA et votre session ProConnect sont fermées.</p>
      <Button linkProps={{ href: "/connexion" }}>Se connecter</Button>
    </div>
  );
}
