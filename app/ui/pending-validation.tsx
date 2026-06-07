import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";

// Message affiché à un utilisateur connecté mais pas encore validé par un
// administrateur. Tant qu'il n'est pas validé, il n'accède ni aux pages
// connectées ni aux données.
export function PendingValidation() {
  return (
    <div className={fr.cx("fr-py-6w")}>
      <Alert
        severity="info"
        title="Compte en attente de validation"
        description="Votre compte a bien été créé. Un administrateur doit le valider avant que vous puissiez accéder aux dossiers. Merci de réessayer ultérieurement."
      />
    </div>
  );
}
