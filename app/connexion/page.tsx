import { fr } from "@codegouvfr/react-dsfr";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/app/lib/auth";
import { ProConnectLoginButton } from "@/app/ui/button/proconnect-login-button";

export default async function ConnexionPage() {
  // Déjà connecté → on n'a rien à faire sur la page de connexion.
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) {
    redirect("/case_files");
  }

  return (
    <div className={fr.cx("fr-container", "fr-py-6w")}>
      <h1>Connexion</h1>
      <p>Connectez-vous avec ProConnect pour accéder à DAHL&apos;ia.</p>
      <ProConnectLoginButton />
    </div>
  );
}
