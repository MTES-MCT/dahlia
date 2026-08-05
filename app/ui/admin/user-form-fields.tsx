import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Select } from "@codegouvfr/react-dsfr/Select";
import type { JurisdictionListRow } from "@/app/lib/data/jurisdictions";
import type { UserListRow } from "@/app/lib/data/users";

export type UserFormValues = Pick<
  UserListRow,
  "email" | "firstName" | "lastName" | "isValidated" | "isAdmin"
> & {
  // Permission scope: ids of the jurisdictions currently granted to the user.
  jurisdictionIds: number[];
};

export const EMPTY_USER_FORM_VALUES: UserFormValues = {
  email: "",
  firstName: null,
  lastName: null,
  isValidated: false,
  isAdmin: false,
  jurisdictionIds: [],
};

const PROCONNECT_EMAIL_WARNING =
  "L'email doit être celui que l'utilisateur utilise avec ProConnect. Sinon, il ne pourra pas se connecter à ce compte.";

const JURISDICTIONS_HINT =
  "Périmètre de droit de l'utilisateur. Maintenez Ctrl (Cmd sur Mac) pour en sélectionner plusieurs. Si aucune juridiction n'est sélectionnée, l'utilisateur n'aura accès à aucun dossier.";

// Number of visible rows in the jurisdictions list box.
const JURISDICTIONS_MIN_ROWS = 3;
const JURISDICTIONS_MAX_ROWS = 8;

function jurisdictionOptionLabel(jurisdiction: JurisdictionListRow): string {
  // `name` is left empty by the scraper until an admin fills it in.
  return jurisdiction.name
    ? `${jurisdiction.shortName} — ${jurisdiction.name}`
    : jurisdiction.shortName;
}

// Shared create/edit fields for the admin user modals.
export function UserFormFields({
  values,
  jurisdictions,
}: {
  values: UserFormValues;
  jurisdictions: JurisdictionListRow[];
}) {
  return (
    <>
      <Alert severity="warning" small description={PROCONNECT_EMAIL_WARNING} />

      <Input
        label="Email"
        hintText="Obligatoire"
        className={fr.cx("fr-mt-2w")}
        nativeInputProps={{
          name: "email",
          type: "email",
          required: true,
          autoComplete: "off",
          defaultValue: values.email,
        }}
      />

      <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
        <Input
          label="Nom"
          className={fr.cx("fr-col-12", "fr-col-md-6")}
          nativeInputProps={{
            name: "lastName",
            autoComplete: "off",
            defaultValue: values.lastName ?? "",
          }}
        />
        <Input
          label="Prénom"
          className={fr.cx("fr-col-12", "fr-col-md-6")}
          nativeInputProps={{
            name: "firstName",
            autoComplete: "off",
            defaultValue: values.firstName ?? "",
          }}
        />
      </div>

      <Checkbox
        className={fr.cx("fr-mt-1w")}
        options={[
          {
            label: "Validé",
            nativeInputProps: {
              name: "isValidated",
              value: "on",
              defaultChecked: values.isValidated,
            },
          },
          {
            label: "Administrateur",
            nativeInputProps: {
              name: "isAdmin",
              value: "on",
              defaultChecked: values.isAdmin,
            },
          },
        ]}
      />

      {jurisdictions.length === 0 ? (
        <Alert
          severity="info"
          small
          className={fr.cx("fr-mt-2w")}
          description="Aucune juridiction enregistrée : le périmètre de droit ne peut pas encore être défini."
        />
      ) : (
        <Select
          label="Juridictions"
          hint={JURISDICTIONS_HINT}
          className={fr.cx("fr-mt-2w")}
          nativeSelectProps={{
            name: "jurisdictionIds",
            multiple: true,
            size: Math.min(
              Math.max(jurisdictions.length, JURISDICTIONS_MIN_ROWS),
              JURISDICTIONS_MAX_ROWS,
            ),
            autoComplete: "off",
            defaultValue: values.jurisdictionIds.map(String),
          }}
        >
          {jurisdictions.map((jurisdiction) => (
            <option key={jurisdiction.id} value={jurisdiction.id}>
              {jurisdictionOptionLabel(jurisdiction)}
            </option>
          ))}
        </Select>
      )}
    </>
  );
}
