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
  "Accusé de réception de la requête - DALO": ["DOSSIER_COMED_2_Accuse_reception_DALO-2.pdf"],
  "Aide juridictionelle": ["Aide_juridictionelle.pdf"],
  "Autre(s) pièce(s)": [
    // "Autre(s)_piece(s).pdf",
    "2402785_1143629463.pdf",
    "getdoc.pdf",
    "2411158_20022025_1147930341-1.pdf",
  ],
  "Avis d'audience": ["Avis_d_audience.pdf"],
  "Avis d'audience - DALO": [
    //"Avis_d_audience_-_DALO.pdf",
    "1142338213_aviaudal.pdf",
  ],
  "Avis de radiation du dossier à l'audience": ["Avis_de_radiation_du_dossier_a_l_audience.pdf"],
  "Avis de renvoi d'audience": ["Avis_de_renvoi_d_audience.pdf"],
  "Avis de renvoi à une autre audience": ["Avis_de_renvoi_a_une_autre_audience.pdf"],
  "Avis de renvoi à une autre audience (référé)": [
    "Avis_de_renvoi_a_une_autre_audience_(refere).pdf",
  ],
  "Communication d'observations": ["Communication_d_observations.pdf"],
  "Communication d'un mémoire": [
    // "Communication_d_un_memoire.pdf",
    "1142540512_notmem.pdf",
    "notmem_1147609984.pdf",
  ],
  "Communication d'un mémoire en défense": ["Communication_d_un_memoire_en_defense.pdf"],
  "Communication d'un référé et avis d'audience - urgent": [
    "Communication_d_un_refere_et_avis_d_audience_-_urgent.pdf",
  ],
  "Communication d'une régularisation": ["Communication_d_une_regularisation.pdf"],
  "Communication de la procédure": ["Communication_de_la_procedure.pdf"],
  "Communication de la requête": ["Communication_de_la_requete.pdf"],
  "Communication de la requête - DALO": [
    // "Communication_de_la_requete_-_DALO.pdf",
    "1136210751_comrdal.pdf",
    "comrdal_1144181451-1.pdf",
  ],
  "Communication de la requête - contentieux sociaux - R. 772-8": [
    // "Communication_de_la_requete_-_contentieux_sociaux_-_R._772-8.pdf",
    "comrqsoc_1143417502.pdf",
  ],
  "Communication de la requête et avis d'audience": [
    "Communication_de_la_requete_et_avis_d_audience.pdf",
  ],
  "Communication de la requête et avis d'audience - référé": [
    "Communication_de_la_requete_et_avis_d_audience_-_refere.pdf",
  ],
  "Communication de pièces complémentaires": [
    // "Communication_de_pieces_complementaires.pdf",
    "notpcc_1143047033.pdf",
  ],
  "Demande d'exécution du jugement": ["Demande_d_execution_du_jugement.pdf"],
  "Demande de délai supplémentaire": ["Demande_de_delai_supplementaire.pdf"],
  "Demande de pièces pour complèter l'instruction": [
    "Demande_de_pieces_pour_completer_l_instruction.pdf",
  ],
  "Demande sur l'état de l'instruction": ["Demande_sur_l_etat_de_l_instruction.pdf"],
  "Décision attaquée": ["Decision_attaquee.pdf"],
  "Décision de la juridiction": [
    // "Decision_de_la_juridiction.pdf",
    "J_1143412492.pdf",
  ],
  "EXE - Demande à l'administration d'exécuter une décision": [
    "EXE_-_Demande_a_l_administration_d_executer_une_decision.pdf",
  ],
  "EXE - Notif. ordonnance - ouverture proc. juridictionnelle": [
    "EXE_-_Notif._ordonnance_-_ouverture_proc._juridictionnelle.pdf",
  ],
  "Inventaire document": [
    // "Inventaire_document.pdf",
    "1142534183_Inventaire_des_pieces_2.pdf",
    "1142971678_Inventaire_des_pieces.pdf",
    "inventaireAutomatique_806073205_1142998355.pdf",
  ],
  "Inventaire requête": [
    // "Inventaire_requete.pdf",
    "1136075503_Inventaire_des_pieces.pdf",
  ],
  Lettre: [
    // "Lettre.pdf",
    "MD_2402885_L_PP.pdf",
    "MD_IIA_2411158_H_PP-1-1.pdf",
    "DOSSIER_COMED_3-Lettre_recours_gracieux_rejet_DALO.pdf",
    "DOSSIER_COMED_3_Lettre_recours_gracieux_rejet_DALO.pdf",
    "DOSSIER_COMED_18_Lettre_envoie_pieces_complementaires.pdf",
  ],
  "Lettre d'information - R. 611-11-1": ["Lettre_d_information_-_R._611-11-1.pdf"],
  "Lettre du greffier": ["Lettre_du_greffier.pdf"],
  "Mise en demeure défendeur": [
    // "Mise_en_demeure_defendeur.pdf",
    "MD_2402785_RP_localisation.pdf",
    "MD_J_2410482.pdf",
  ],
  Mémoire: [
    // "Memoire.pdf",
    "1142534179_Memoire.pdf",
  ],
  "Mémoire en défense": [
    // "Memoire_en_defense.pdf",
    "DDETS_ecritures_en_reponse_A_2402785.pdf",
    "DDETS_ecritures_en_reponse_A__2402785.pdf",
    "DDETS_ecritures_en_reponse_A__2402785_1142997044.pdf",
  ],
  "Mémoire en défense - référé": ["Memoire_en_defense_-_refere.pdf"],
  "Note en délibéré": [
    // "Note_en_delibere.pdf",
    "Note_en_delibere_2410482.pdf",
  ],
  "Notification d'ordonnance de report de cloture d'instruction": [
    "Notification_d_ordonnance_de_report_de_cloture_d_instruction.pdf",
  ],
  "Notification d'une ordonnance": [
    //"Notification_d_une_ordonnance.pdf",
    "1137780804_notorins.pdf",
    "notorins_1144181466-1.pdf",
  ],
  "Notification d'une ordonnance - clôture d'instruction": [
    // "Notification_d_une_ordonnance_-_cloture_d_instruction.pdf",
    "1137746597_ORD_CLOT_blablabla_cm.pdf",
    "OCI_au_12-12-24_1144174211-1.pdf",
  ],
  "Notification d'une ordonnance - référé liberté": [
    "Notification_d_une_ordonnance_-_refere_liberte.pdf",
  ],
  "Notification de jugement": [
    // "Notification_de_jugement.pdf",
    "notjuge_1167876171.pdf",
    "2410482_J_ok_1167865431.pdf",
  ],
  "Notification décision": [
    // "Notification_decision.pdf",
    "notdeci_1143635358.pdf",
    "notdeci_1147950896-1.pdf",
  ],
  "Pièce jointe document": [
    // "Piece_jointe_document.pdf",
    "1142534186_4_Demande_de_logement_social.pdf",
    "1142534189_5_Certificat_medical_du_Docteurdu_9_juin_2022.pdf",
    "1142534191_6_Courrier_du_Docteur_du_26.09.2022.pdf",
    "1142534196_7_Certificat_medical_du_Docteur_du_26.09.2022.pdf",
    "1142534198_8_Courrier_du_Docteur_du_16.11.2022.pdf",
    "1142534200_9_IRM_du_pied_droit_du_17.01.2023.pdf",
    "1142534202_10_Radiographie_du_rachis_dorsolombaire_et_du_bassin_du_17.01.2023.pdf",
    "1142534203_11_Courrier_du_Docteur_du_15.05.2023.pdf",
    "1142534204_12_Courrier_du_Docteur_du_05.06.2023.pdf",
    "1142534206_13_Courrier_du_Docteur_du_04.09.2023.pdf",
    "1142534210_14_Decision_de_la_CDAPH_du_18.11.2020.pdf",
    "1142534216_15_Carte_mobilite_inclusion.pdf",
    "1142534220_16_Attestation_CAF_du_20.09.2023.pdf",
    "1142534225_17_Attestation_de_Mme_la_cousine_du_28.11.2022.pdf",
    "1142534230_18_Recours_amiable_devant_la_Commission_DALO_du_18.10.2022.pdf",
    "1142971698_19_Courrier_du_Docteur_Imen_D_du_4_septembre_2024.pdf",
    "1142971732_20_Certificat_medical_du_Docteur_du_27_septembre_2024.pdf",
    "Preuve_DDETS_ecritures_en_reponse_A_2402785.pdf.pdf",
  ],
  "Pièce jointe requête": [
    // "Piece_jointe_requete.pdf",
    "1136075532_1_Decision_de_la_Commission_de_mediation_du_14_fevrier_2023.pdf",
    "1136075536_2_Ordonnance_du_15_decembre_2023.pdf",
    "1136075539_3_Compte_rendu_d_hospitalisation_du_Docteur__du_09.02.2024.pdf",
    "1_Proposition_DALO_24.05.24.pdf",
    "2_Refus_proposition_DALO.pdf",
    "3_Courriel_sortie_DALO_24.06.24.pdf",
    "Decision_de_la_Commission_de_mediation_du_14_fevrier_2023.pdf",
    "1_bis_Decision_20-08-2024-2.pdf",
    "4-Decision_23-04-2024-1.pdf",
    "4-Decision_23-04-2024-2.pdf",
    "DOSSIER_COMED_1_Decision_23-04-2024.pdf",
    "DOSSIER_COMED_4_AR_Gracieux_DALO_1166332646.pdf",
    "DOSSIER_COMED_5_Argumentaire_technique_accessibilite_domicile_HCL_1166332651.pdf",
    "DOSSIER_COMED_6_Decision_gracieux_20-08-2024-1_1166332655.pdf",
    "DOSSIER_COMED_7_Mail_DALO_a_bailleur_1166332656.pdf",
    "DOSSIER_COMED_8_Demande_pieces_complementaire_1166332657.pdf",
    "DOSSIER_COMED_9_avis_echeance_02-2024_1166332661.pdf",
    "DOSSIER_COMED_10_Bail.pdf",
    "DOSSIER_COMED_11_Recours_amiable_DALO.pdf",
    "DOSSIER_COMED_12_Carte_invalidite_J_Aicha.pdf",
    "DOSSIER_COMED_13_Impots_2022.pdf",
    "DOSSIER_COMED_13_Impots_2022-2.pdf",
    "DOSSIER_COMED_13_Impots_2022-3.pdf",
    "DOSSIER_COMED_14_releve_mensualite_retraite.pdf",
    "DOSSIER_COMED_15_Attestation_CAF.pdf",
    "DOSSIER_COMED_16_CNI_J.pdf",
    "DOSSIER_COMED_17_Carte_identite_belge_L.pdf",
    "DOSSIER_COMED_18_Attestation_demande_logement_social.pdf",
    "DOSSIER_COMED_19_Retour_bailleur_J_courriel.pdf",
    "DOSSIER_COMED_20_Retour_bailleur_J_courriel.pdf",
    "DOSSIER_COMED_21_Retour_bailleur_J_courriel_3.pdf",
    "DOSSIER_COMED_23_Echange_bailleur_conseillere_sociale.pdf",
    "DOSSIER_COMED_24_Courrier_bailleur_requerante_27.03.2026.pdf",
  ],
  Pièces: ["Pieces.pdf"],
  "Pièces complémentaires": [
    // "Pieces_complementaires.pdf",
    "2-pieces_compl_REQ_2410482_1147556249.pdf",
  ],
  "Pièces demandées": ["Pieces_demandees.pdf"],
  Requête: [
    // "Requete.pdf",
    "1136075500_Requete_TA.pdf",
    "Requete_A.pdf",
    "1-Requete_2405328_IIL_1144107799-1-1.pdf",
  ],
  "Réponse sur l'état de l'instruction": [
    // "Reponse_sur_l_etat_de_l_instruction.pdf",
    "C_2402785_RP_repport_CI.pdf",
  ],
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
