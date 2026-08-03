import { fr } from "@codegouvfr/react-dsfr";
import { Alert } from "@codegouvfr/react-dsfr/Alert";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { Input } from "@codegouvfr/react-dsfr/Input";
import type { UserListRow } from "@/app/lib/data/users";

export type UserFormValues = Pick<
  UserListRow,
  "email" | "firstName" | "lastName" | "isValidated" | "isAdmin"
>;

export const EMPTY_USER_FORM_VALUES: UserFormValues = {
  email: "",
  firstName: null,
  lastName: null,
  isValidated: false,
  isAdmin: false,
};

const PROCONNECT_EMAIL_WARNING =
  "L'email doit être celui que l'utilisateur utilise avec ProConnect. Sinon, il ne pourra pas se connecter à ce compte.";

// Shared create/edit fields for the admin user modals.
export function UserFormFields({ values }: { values: UserFormValues }) {
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
    </>
  );
}
