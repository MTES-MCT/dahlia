import { Input } from "@codegouvfr/react-dsfr/Input";

type Props = {
  // Form field name carried over by the native GET search submit.
  name: string;
  value: string;
};

// DSFR-styled hidden form field used to carry URL state (sort, other tables'
// params, selected tab…) across a native GET search submit.
export function HiddenField({ name, value }: Props) {
  return <Input label={name} hideLabel nativeInputProps={{ type: "hidden", name, value }} />;
}
