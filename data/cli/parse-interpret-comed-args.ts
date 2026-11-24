export const INTERPRET_COMED_USAGE = `Usage: pnpm interpret:comed -- [options]

Repère les décisions de la commission de médiation (COMED) parmi les pièces
jointes (mêmes règles que find-comed-decisions), puis envoie chaque pièce pas
encore interprétée à DocumentIA pour confirmer qu'il s'agit d'une décision COMED
et en extraire les métadonnées (table attached_file_interpretations).
Reporte ensuite la décision COMED la plus récente de chaque dossier (n° ComDalo,
date de décision, champs vides uniquement sauf --force-document-ia, à valider
par un agent) et type les
pièces confirmées « décision COMED ».

  --jurisdiction <code>    Limite à une juridiction Dahlia (ex. TA069, TA069bis), comme
                           scrape:telerecours. Défaut : toutes les juridictions.
  --enrich <all|ongoing>   ongoing (défaut) : pièces des dossiers non terminés uniquement ;
                           all : pièces de tous les dossiers (y compris « Terminé »).
  --force-document-ia      Relance l'interprétation même si la pièce est déjà interprétée,
                           et remplace le n° ComDalo / la date COMED déjà renseignés s'ils
                           diffèrent de la décision la plus récente (y compris une saisie
                           manuelle).
  --dry-run                Interprète et stocke les résultats DocumentIA, mais n'écrit ni le
                           n° ComDalo / la date COMED du dossier, ni le type des pièces ;
                           affiche les changements prévus.
  --help, -h               Affiche cette aide.

Variables d'environnement : DOCUMENT_IA_URL, DOCUMENT_IA_API_KEY (cf. .env.example).
`;

export const INTERPRET_ENRICH_MODES = ["all", "ongoing"] as const;
export type InterpretEnrichMode = (typeof INTERPRET_ENRICH_MODES)[number];

export interface InterpretComedCliArgs {
  jurisdiction: string | null;
  enrich: InterpretEnrichMode;
  forceDocumentIa: boolean;
  // Absent means false.
  dryRun?: boolean;
  help: boolean;
}

// Parse process.argv for the COMED-interpretation CLI. Pure function: no
// environment access, no I/O.
export function parseInterpretComedArgs(argv: string[] = process.argv): InterpretComedCliArgs {
  const args: InterpretComedCliArgs = {
    jurisdiction: null,
    enrich: "ongoing",
    forceDocumentIa: false,
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      // pnpm forwards the option separator.
    } else if (arg === "--jurisdiction") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) {
        throw new Error(
          "--jurisdiction attend un code de juridiction Dahlia (ex. TA069, TA069bis).",
        );
      }
      args.jurisdiction = value;
    } else if (arg === "--enrich") {
      const value = argv[++i];
      const mode = INTERPRET_ENRICH_MODES.find((candidate) => candidate === value);
      if (!mode) {
        throw new Error(`Valeur --enrich invalide : "${value ?? ""}". Attendu : all | ongoing.`);
      }
      args.enrich = mode;
    } else if (arg === "--force-document-ia") {
      args.forceDocumentIa = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}
