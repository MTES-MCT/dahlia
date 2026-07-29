import type { Metadata } from "next";
import { StartDsfrOnHydration } from "../src/dsfr-bootstrap";
import { fr } from "@codegouvfr/react-dsfr";
import { Tile } from "@codegouvfr/react-dsfr/Tile";
import CityHall from "@codegouvfr/react-dsfr/picto/CityHall";
import Community from "@codegouvfr/react-dsfr/picto/Community";

export const metadata: Metadata = {
  title: "Accueil",
};

export default function Home() {
  return (
    <>
      <StartDsfrOnHydration />

      <h1 className={fr.cx("fr-mt-3w")}>Bienvenue sur DAHLIA</h1>

      <h2>Vous êtes en charge du contentieux DAHO / DALO en service déconcentré ?</h2>

      <p>
        Nourrie par Télérecours, DAHLIA vous permet de retrouver l&apos;ensemble de vos
        dossiers&nbsp;<strong>structurés</strong>&nbsp;et&nbsp;<strong>priorisés</strong>&nbsp;pour
        plonger rapidement dans&nbsp;<strong>l&apos;analyse juridique</strong>&nbsp;et la rédaction
        de vos mémoires.
      </p>

      <p>
        Confiez-lui vos tâches administratives pour améliorer la défense des intérêts de l&apos;Etat
        !
      </p>

      <div
        className={fr.cx("fr-grid-row", "fr-grid-row--gutters", "fr-grid-row--center", "fr-my-4w")}
      >
        <div className={fr.cx("fr-col-12", "fr-col-md-5")}>
          <Tile
            title="Vous êtes une administration"
            desc="Connectez-vous pour accéder à vos dossiers."
            pictogram={<CityHall />}
            linkProps={{ href: "/connexion" }}
            enlargeLinkOrButton
          />
        </div>
        <div className={fr.cx("fr-col-12", "fr-col-md-5")}>
          <Tile
            title="Vous êtes un particulier"
            desc="Retrouvez vos démarches sur service-public.fr."
            pictogram={<Community />}
            linkProps={{
              href: "https://www.service-public.gouv.fr/particuliers/vosdroits/F18005",
              rel: "noopener noreferrer",
              target: "_self",
            }}
            enlargeLinkOrButton
          />
        </div>
      </div>
    </>
  );
}
