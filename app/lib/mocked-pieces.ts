import { readFile } from "node:fs/promises";
import path from "node:path";

// In non-production environments we never reach Télérecours to download the real
// pièce content. Instead we serve a fake PDF picked from `files/mocked_pdfs`,
// chosen according to the pièce type (`fileTypeLabel`). When a type maps to
// several files we pick one at random; unknown types fall back to `Autre.pdf`.

export const MOCKED_PDF_FALLBACK = "Autre.pdf";

const MOCKED_PDF_DIR = path.join(process.cwd(), "files", "mocked_pdfs");

// Mapping from a pièce type (`fileTypeLabel`) to the candidate mocked PDF files.
// Keys are matched after trimming surrounding whitespace.
const MOCKED_PDF_BY_TYPE: Record<string, string[]> = {
  "Accusé de réception de la requête": ["Accuse_de_reception_de_la_requete.pdf"],
  "Accusé de réception de la requête - DALO": [
    "Accuse_de_reception_de_la_requete_-_DALO_1.pdf",
    "Accuse_de_reception_de_la_requete_-_DALO_2.pdf",
  ],
  "Aide juridictionelle": ["Aide_juridictionelle.pdf"],
  "Autre(s) pièce(s)": ["Autre(s)_piece(s).pdf"],
  "Avis d'audience": ["Avis_d_audience.pdf"],
  "Avis d'audience - DALO": ["Avis_d_audience_-_DALO.pdf"],
  "Avis de radiation du dossier à l'audience": ["Avis_de_radiation_du_dossier_a_l_audience.pdf"],
  "Avis de renvoi d'audience": ["Avis_de_renvoi_d_audience.pdf"],
  "Avis de renvoi à une autre audience": ["Avis_de_renvoi_a_une_autre_audience.pdf"],
  "Avis de renvoi à une autre audience (référé)": [
    "Avis_de_renvoi_a_une_autre_audience_(refere).pdf",
  ],
  "Communication d'observations": ["Communication_d_observations.pdf"],
  "Communication d'un mémoire": ["Communication_d_un_memoire.pdf"],
  "Communication d'un mémoire en défense": ["Communication_d_un_memoire_en_defense.pdf"],
  "Communication d'un référé et avis d'audience - urgent": [
    "Communication_d_un_refere_et_avis_d_audience_-_urgent.pdf",
  ],
  "Communication d'une régularisation": ["Communication_d_une_regularisation.pdf"],
  "Communication de la procédure": ["Communication_de_la_procedure.pdf"],
  "Communication de la requête": ["Communication_de_la_requete.pdf"],
  "Communication de la requête - DALO": ["Communication_de_la_requete_-_DALO.pdf"],
  "Communication de la requête - contentieux sociaux - R. 772-8": [
    "Communication_de_la_requete_-_contentieux_sociaux_-_R._772-8.pdf",
  ],
  "Communication de la requête et avis d'audience": [
    "Communication_de_la_requete_et_avis_d_audience.pdf",
  ],
  "Communication de la requête et avis d'audience - référé": [
    "Communication_de_la_requete_et_avis_d_audience_-_refere.pdf",
  ],
  "Communication de pièces complémentaires": ["Communication_de_pieces_complementaires.pdf"],
  "Demande d'exécution du jugement": ["Demande_d_execution_du_jugement.pdf"],
  "Demande de délai supplémentaire": ["Demande_de_delai_supplementaire.pdf"],
  "Demande de pièces pour complèter l'instruction": [
    "Demande_de_pieces_pour_completer_l_instruction.pdf",
  ],
  "Demande sur l'état de l'instruction": ["Demande_sur_l_etat_de_l_instruction.pdf"],
  "Décision attaquée": ["Decision_attaquee.pdf"],
  "Décision de la juridiction": ["Decision_de_la_juridiction.pdf"],
  "EXE - Demande à l'administration d'exécuter une décision": [
    "EXE_-_Demande_a_l_administration_d_executer_une_decision.pdf",
  ],
  "EXE - Notif. ordonnance - ouverture proc. juridictionnelle": [
    "EXE_-_Notif._ordonnance_-_ouverture_proc._juridictionnelle.pdf",
  ],
  "Inventaire document": ["Inventaire_document.pdf"],
  "Inventaire requête": ["Inventaire_requete.pdf"],
  Lettre: ["Lettre.pdf"],
  "Lettre d'information - R. 611-11-1": ["Lettre_d_information_-_R._611-11-1.pdf"],
  "Lettre du greffier": ["Lettre_du_greffier.pdf"],
  "Mise en demeure défendeur": ["Mise_en_demeure_defendeur.pdf"],
  Mémoire: ["Memoire.pdf"],
  "Mémoire en défense": ["Memoire_en_defense.pdf"],
  "Mémoire en défense - référé": ["Memoire_en_defense_-_refere.pdf"],
  "Note en délibéré": ["Note_en_delibere.pdf"],
  "Notification d'ordonnance de report de cloture d'instruction": [
    "Notification_d_ordonnance_de_report_de_cloture_d_instruction.pdf",
  ],
  "Notification d'une ordonnance": ["Notification_d_une_ordonnance.pdf"],
  "Notification d'une ordonnance - clôture d'instruction": [
    "Notification_d_une_ordonnance_-_cloture_d_instruction.pdf",
  ],
  "Notification d'une ordonnance - référé liberté": [
    "Notification_d_une_ordonnance_-_refere_liberte.pdf",
  ],
  "Notification de jugement": ["Notification_de_jugement.pdf"],
  "Notification décision": ["Notification_decision.pdf"],
  "Pièce jointe document": ["Piece_jointe_document.pdf"],
  "Pièce jointe requête": ["Piece_jointe_requete.pdf"],
  Pièces: ["Pieces.pdf"],
  "Pièces complémentaires": ["Pieces_complementaires.pdf"],
  "Pièces demandées": ["Pieces_demandees.pdf"],
  Requête: ["Requete.pdf"],
  "Réponse sur l'état de l'instruction": ["Reponse_sur_l_etat_de_l_instruction.pdf"],
};

// Pick a mocked PDF file name for the given pièce type, at random when several
// candidates exist. Falls back to `Autre.pdf` when the type is unknown.
export function pickMockedPdfFileName(fileTypeLabel: string | null | undefined): string {
  const candidates = MOCKED_PDF_BY_TYPE[(fileTypeLabel ?? "").trim()];
  if (!candidates || candidates.length === 0) {
    return MOCKED_PDF_FALLBACK;
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Read the bytes of a mocked PDF chosen for the given pièce type.
export async function readMockedPdf(
  fileTypeLabel: string | null | undefined,
): Promise<{ data: Buffer; fileName: string }> {
  const fileName = pickMockedPdfFileName(fileTypeLabel);
  const data = await readFile(path.join(MOCKED_PDF_DIR, fileName));
  return { data, fileName };
}
