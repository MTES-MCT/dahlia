type Props = {
  // Form field name carried over by the native GET search submit.
  name: string;
  value: string;
};

// Hidden form field used to carry URL state (sort, other tables' params,
// selected tab…) across a native GET search submit. A plain input: it has no
// label nor visual, so it must not be wrapped in a DSFR `fr-input-group`.
export function HiddenField({ name, value }: Props) {
  return <input type="hidden" name={name} value={value} />;
}
