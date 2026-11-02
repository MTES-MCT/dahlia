// Characters that act as path separators or are illegal in common file systems.
const FORBIDDEN_FILE_NAME_CHARS = /[/\\:*?"<>|]/g;

export function sanitizeFileName(name: string): string {
  return name.replace(FORBIDDEN_FILE_NAME_CHARS, "_");
}

// Reject user-provided pièce names that could be abused as archive entry paths.
export function dahliaNameValidationError(name: string): string | null {
  if (/[/\\:*?"<>|]/.test(name)) {
    return "Le nom ne peut pas contenir / \\ : * ? \" < > |.";
  }
  if (name.includes("..")) {
    return "Le nom ne peut pas contenir ..";
  }
  return null;
}
