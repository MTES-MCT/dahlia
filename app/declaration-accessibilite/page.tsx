import type { Metadata } from "next";
import { fr } from "@codegouvfr/react-dsfr";

export const metadata: Metadata = {
  title: "Déclaration d'accessibilité",
};

export default function DeclarationAccessibilitePage() {
  return (
    <div className={fr.cx("fr-py-6w")}>
      <div className={fr.cx("fr-grid-row")}>
        <div className={fr.cx("fr-col-12", "fr-col-md-8")}>
          <h1>Déclaration d&apos;accessibilité</h1>
          <p>
            DAHLIA s&apos;engage à rendre son site internet accessible conformément à l&apos;article
            47 de la loi n° 2005-102 du 11 février 2005. À cette fin, nous n&apos;avons pas encore
            publié de schéma pluriannuel détaillant la stratégie et les actions à mettre en œuvre.
          </p>
          <p>
            Cette déclaration d&apos;accessibilité s&apos;applique au site DAHLIA&nbsp;:{" "}
            <a href="https://dahlia.beta.gouv.fr" className={fr.cx("fr-link")}>
              dahlia.beta.gouv.fr
            </a>
          </p>

          <h2>État de conformité</h2>
          <p>
            DAHLIA est <strong>non conforme</strong> avec le référentiel général d&apos;amélioration
            de l&apos;accessibilité (RGAA), version 4, faute d&apos;audit de conformité en cours de
            validité permettant de mesurer le respect des critères.
          </p>

          <h2>Résultat des tests</h2>
          <p>
            En l&apos;absence d&apos;audit de conformité, il n&apos;y a pas de résultats de tests à
            publier.
          </p>

          <h2>Contenus non accessibles</h2>
          <p>Les contenus listés ci-dessous ne sont pas accessibles pour les raisons suivantes.</p>

          <h3>Non-conformité</h3>
          <p>
            En l&apos;absence d&apos;audit, l&apos;ensemble des contenus est susceptible de ne pas
            respecter un ou plusieurs critères du RGAA.
          </p>

          <h3>Dérogations pour charge disproportionnée</h3>
          <p>Aucune dérogation n&apos;a été établie.</p>

          <h3>Contenus non soumis à l&apos;obligation d&apos;accessibilité</h3>
          <p>
            Aucun contenu n&apos;a été identifié comme n&apos;entrant pas dans le champ de la
            législation applicable.
          </p>

          <h2>Établissement de cette déclaration d&apos;accessibilité</h2>
          <p>Cette déclaration a été établie le 21 septembre 2026.</p>

          <h3>Technologies utilisées pour la réalisation du site web</h3>
          <ul>
            <li>HTML</li>
            <li>CSS</li>
            <li>JavaScript</li>
          </ul>

          <h2>Retour d&apos;information et contact</h2>
          <p>
            Si vous n&apos;arrivez pas à accéder à un contenu ou à un service, vous pouvez contacter
            le responsable du site web pour être orienté vers une alternative accessible ou obtenir
            le contenu sous une autre forme.
          </p>
          <ul>
            <li>
              Adresse de contact :{" "}
              <a href="mailto:dahl-ia@beta.gouv.fr" className={fr.cx("fr-link")}>
                dahl-ia@beta.gouv.fr
              </a>
            </li>
          </ul>

          <h2>Voie de recours</h2>
          <p>
            Cette procédure est à utiliser dans le cas suivant. Vous avez signalé au responsable du
            site web un défaut d&apos;accessibilité qui vous empêche d&apos;accéder à un contenu ou
            à un des services et vous n&apos;avez pas obtenu de réponse satisfaisante.
          </p>
          <ul>
            <li>
              Écrire un message au Défenseur des droits :{" "}
              <a href="https://formulaire.defenseurdesdroits.fr/" className={fr.cx("fr-link")}>
                https://formulaire.defenseurdesdroits.fr/
              </a>
            </li>
            <li>
              Contacter le délégué du Défenseur des droits dans votre région :{" "}
              <a
                href="https://www.defenseurdesdroits.fr/saisir/delegues"
                className={fr.cx("fr-link")}
              >
                https://www.defenseurdesdroits.fr/saisir/delegues
              </a>
            </li>
            <li>
              Envoyer un courrier par la poste (gratuit, ne pas mettre de timbre)
              <br />
              <br />
              Défenseur des droits
              <br />
              Libre réponse 71120
              <br />
              75342 Paris CEDEX 07
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
