import { fr } from "@codegouvfr/react-dsfr";

// Banner displayed above the header on every non-production environment,
// to make it obvious which environment the user is currently browsing.
// Renders nothing when running in production.
export function EnvironmentBanner({ environment }: { environment?: string }) {
  if (environment === "production") {
    return null;
  }

  return (
    <div
      role="status"
      style={{
        backgroundColor: "var(--background-flat-warning, #b34000)",
        color: "#ffffff",
        textAlign: "center",
        fontWeight: 700,
      }}
      className={fr.cx("fr-p-1v", "fr-text--sm", "fr-mb-0")}
    >
      Vous êtes en environnement de {environment ?? "développement"}
    </div>
  );
}
