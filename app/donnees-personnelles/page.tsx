import type { Metadata } from "next";
import { fr } from "@codegouvfr/react-dsfr";
import { Table } from "@codegouvfr/react-dsfr/Table";

export const metadata: Metadata = {
  title: "Données personnelles",
};

const DATA_CATEGORIES: string[][] = [
  ["Données d'identité", "Nom, prénom, adresse, numéros de téléphone, adresse électronique."],
  [
    "Données relatives à la situation administrative",
    "Notamment : les éléments figurant sur les autorisations, titres et cartes de séjour ou document de circulation pour le ressortissant étranger, carte d'identité, passeports, permis de conduire, autorisations administratives.",
  ],
  [
    "Données relatives à la vie personnelle mentionnées dans les pièces de procédure transmises",
    "Capacité des personnes, situation familiale, date et lieu de mariage ou de PACS, date de divorce ou de rupture de PACS, nombre d'enfants.",
  ],
  [
    "Données relatives à la vie professionnelle, au parcours scolaire et universitaire et à la situation financière mentionnées dans les pièces de procédure transmises",
    "Notamment : niveau d'étude, situation professionnelle, titre, grade et emploi, relations de travail, statut, droits à la retraite, tous éléments de rémunération, situation fiscale.",
  ],
  [
    "Données relatives au patrimoine des personnes physiques mentionnées dans les pièces de procédure transmises",
    "Notamment : données bancaires dont numéros de comptes, éléments issus de pièces comptables, biens et droits mobiliers et immobiliers, publicité foncière et références cadastrales, situation relative à l'aide juridictionnelle.",
  ],
  [
    "Données relatives au litige",
    "Mode de saisine, nature et date du litige, décision administrative contestée, nature et sens de la décision de première instance ou d'appel.",
  ],
  [
    "Données relatives à la navigation sur les sites web",
    "Statistiques d'audience et d'utilisation, traceurs.",
  ],
];

export default function DonneesPersonnellesPage() {
  return (
    <div className={fr.cx("fr-py-6w")}>
      <div className={fr.cx("fr-grid-row")}>
        <div className={fr.cx("fr-col-12", "fr-col-lg-10")}>
          <h1>Données personnelles</h1>
          <p className={fr.cx("fr-text--lead")}>
            Politique de protection des données à caractère personnel
          </p>
          <p className={fr.cx("fr-hint-text")}>Dernière mise à jour : 21 septembre 2026</p>

          <h2>Information « RGPD » : DAHLIA</h2>

          <h3>Responsable de traitement</h3>
          <p>
            Le traitement DAHLIA est mis en œuvre sous la responsabilité du Directeur général de
            l&apos;aménagement, du logement et de la nature du Ministère de la transition
            écologique, aménagement du territoire, transports, ville et logement.
          </p>

          <h3>Base légale et finalités</h3>
          <p>Le traitement est mis en œuvre pour les finalités suivantes :</p>
          <ul>
            <li>Gestion des contentieux des services logement et hébergement des DDETS</li>
            <li>
              Suivi des dossiers et procédures de façon dématérialisée devant les tribunaux
              administratifs
            </li>
            <li>Suivi statistique des contentieux</li>
          </ul>
          <p>
            Ces traitements sont fondés sur la mission d&apos;intérêt public dont est investi le
            ministère en application notamment des articles L. 441-2-3-1 et suivants du code de la
            construction et de l&apos;habitation. Le traitement de ces données est obligatoire pour
            permettre au ministère d&apos;atteindre les objectifs poursuivis.
          </p>

          <h3>Catégories de données et sources</h3>
          <p>Afin d&apos;atteindre les finalités, les données suivantes sont traitées :</p>
          <Table
            bordered
            caption="Catégories de données traitées"
            headers={["Catégorie", "Description"]}
            data={DATA_CATEGORIES}
          />
          <p>
            Le traitement peut enregistrer des données à caractère personnel de la nature de celles
            mentionnées à l&apos;article 6 de la loi du 6 janvier 1978 susvisée, dans la stricte
            mesure où ces données sont contenues dans les pièces de procédure transmises.
          </p>
          <p>
            Ces données proviennent du portail Télérecours administration et des données transmises
            par les services partenaires.
          </p>

          <h3>Personnes concernées et destinataires</h3>
          <p>Les personnes concernées par le traitement sont :</p>
          <ul>
            <li>Parties et représentants au contentieux</li>
          </ul>
          <p>Les destinataires de ces données sont :</p>
          <ul>
            <li>Agents des services de l&apos;État en charge du contentieux</li>
            <li>Leurs sous-traitants éventuels</li>
            <li>
              Autres services dans la mesure où l&apos;appui de ces services dans le cadre du
              traitement de l&apos;affaire et/ou leur connaissance des pièces et procédures est
              nécessaire
            </li>
          </ul>

          <h3>Durées de conservation</h3>
          <p>
            Les données à caractère personnel relatives à chaque affaire pour laquelle
            l&apos;utilisation du téléservice a été acceptée sont conservées pendant une durée de 5
            ans après que cette affaire a fait l&apos;objet d&apos;une décision devenue définitive
            conformément à l&apos;article 11 de l&apos;arrêté du 2 mai 2018.
          </p>
          <p>Elles feront ensuite l&apos;objet d&apos;un archivage.</p>

          <h3>Transfert(s) hors Union européenne</h3>
          <p>
            Les données à caractère personnel traitées dans le cadre du présent traitement ne font
            pas l&apos;objet d&apos;un transfert en dehors de l&apos;Union européenne.
          </p>

          <h3>Exercice de vos droits</h3>
          <p>
            Si vous êtes concerné par le traitement de données à caractère personnel, vous pouvez
            exercer les droits suivants :
          </p>
          <ol>
            <li>Droit d&apos;accès</li>
            <li>Droit de rectification</li>
            <li>Droit à la limitation</li>
          </ol>
          <p>
            Pour toute information ou pour exercer vos droits, vous pouvez contacter le responsable
            de traitement à l&apos;adresse suivante :{" "}
            <a href="mailto:dahl-ia@beta.gouv.fr" className={fr.cx("fr-link")}>
              dahl-ia@beta.gouv.fr
            </a>
          </p>
          <p>
            En cas d&apos;absence de réponse dans le délai d&apos;un mois ou si vous n&apos;êtes pas
            satisfait de la réponse apportée, vous pouvez également ouvrir une réclamation auprès de
            la{" "}
            <a href="https://www.cnil.fr/fr/plaintes" className={fr.cx("fr-link")}>
              CNIL.
            </a>
          </p>

          <h2 id="cookies">Information « Cookies » : DAHLIA</h2>
          <p>
            Le pôle ministériel de la Transition écologique, Aménagement du territoire, Transports,
            Ville et Logement utilise des cookies sur le site.
          </p>
          <p>
            Un « cookie » est une suite d&apos;informations, généralement de petite taille et
            identifié par un nom, qui peut être transmis à votre navigateur par un site web sur
            lequel vous vous connectez. Votre navigateur web le conservera pendant une certaine
            durée, et le renverra au serveur web chaque fois que vous vous y reconnecterez. Les
            cookies ont de multiples usages : ils peuvent servir à mémoriser votre identifiant
            client auprès d&apos;un site marchand, le contenu courant de votre panier d&apos;achat,
            un identifiant permettant de tracer votre navigation pour des finalités statistiques ou
            publicitaires, etc.
          </p>

          <h3>Cookies strictement nécessaires au fonctionnement du site</h3>
          <p>
            Ces cookies permettent aux services principaux du site de fonctionner de manière
            optimale. Vous pouvez techniquement les bloquer en utilisant les paramètres de votre
            navigateur mais votre expérience sur le site risquerait d&apos;être dégradée.
          </p>
        </div>
      </div>
    </div>
  );
}
