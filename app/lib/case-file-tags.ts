// Pre-formatted view of a tag. Plain primitives so it can cross the client
// boundary, same convention as `CaseFileDetailsEditorProps`.
export type CaseFileTagView = { id: number; label: string; color: string };

// Form field names shared by the picker (client) and the server action.
export const TAG_IDS_FIELD_NAME = "tagIds";
// Mirrors the `hasProductionDeadlineFields` convention: tells the server action
// the field was actually rendered, so it never clears tags it was not shown.
export const HAS_TAGS_FIELD_NAME = "hasTagsField";

type CaseFileTagLink = { tag: { id: number; label: string; color: string } };

// Flattens the `case_file_tags` join rows into the view type used by the UI.
// The ordering comes from the Prisma include (`orderBy: { tag: { label } }`).
export function toCaseFileTagViews(caseFileTags: CaseFileTagLink[]): CaseFileTagView[] {
  return caseFileTags.map(({ tag }) => ({ id: tag.id, label: tag.label, color: tag.color }));
}
