export type CarriedSearchParams = Record<string, string | string[] | undefined>;

export function buildBackParams(searchParams: CarriedSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  return params;
}
