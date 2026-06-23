import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { Header, type HeaderProps } from "@codegouvfr/react-dsfr/Header";

// Minimal shape of the authenticated user needed to render the header.
export type HeaderDahliaUser = {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
};

// Application header (DSFR) for DAHL'ia.
// Shows a « Se connecter » link when no user is provided; otherwise displays
// the user's name and a « Se déconnecter » link.
export function HeaderDahlia({ user }: { user?: HeaderDahliaUser | null }) {
  const quickAccessItems: HeaderProps["quickAccessItems"] = user
    ? [
        <p key="user" className={fr.cx("fr-m-1v", "fr-text--sm")}>
          <span className={fr.cx("fr-icon-account-line")} aria-hidden="true" />
          {[user.firstName, user.lastName].filter(Boolean).join(" ") || user.name || user.email}
        </p>,
        {
          iconId: "fr-icon-logout-box-r-line",
          linkProps: { href: "/api/auth/proconnect-logout", prefetch: false },
          text: "Se déconnecter",
        },
      ]
    : [
        {
          iconId: "fr-icon-lock-line",
          linkProps: { href: "/connexion" },
          text: "Se connecter",
        },
      ];

  return (
    <Header
      brandTop={
        <>
          République
          <br />
          Française
        </>
      }
      homeLinkProps={{
        href: "/",
        title: "Accueil - DAHL'ia (Ministères du logement)",
      }}
      id="fr-header-simple-header-with-service-title-and-tagline"
      serviceTagline="Aide au traitement des contentieux du droit au logement et à l'hébergement opposable"
      serviceTitle={
        <>
          DAHLIA{" "}
          <Badge as="span" noIcon severity="success">
            Beta
          </Badge>
        </>
      }
      quickAccessItems={quickAccessItems}
    />
  );
}
