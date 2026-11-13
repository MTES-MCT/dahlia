/** Default anonymization for Télérecours sync (CLI and in-app refresh). */
export function syncAnonymizeByDefault(): boolean {
  if (process.env.ENVIRONMENT === "production") {
    return false;
  }
  if (process.env.NO_ANONYMIZE === "true") {
    return false;
  }
  return true;
}
