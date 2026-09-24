import type { Metadata } from "next";
import { fr } from "@codegouvfr/react-dsfr";

export const metadata: Metadata = {
  title: "Mentions légales",
};

export default function MentionsLegalesPage() {
  return (
    <div className={fr.cx("fr-py-6w")}>
      <div className={fr.cx("fr-grid-row")}>
        <div className={fr.cx("fr-col-12", "fr-col-md-8")}>
          <h1>Mentions légales</h1>
          <p>
            Le présent document a pour objet de définir les modalités et conditions dans lesquelles
            d&apos;une part, le ministre en charge du logement, ci-après dénommé l&apos;ÉDITEUR, met
            à la disposition de ses utilisateurs le site DAHLIA et les services disponibles sur le
            site et d&apos;autre part, la manière par laquelle l&apos;utilisateur accède au site et
            utilise ses services.
          </p>

          <h2>Gestionnaire</h2>
          <p>
            Le traitement DAHLIA est mis en œuvre sous la responsabilité du Directeur général de
            l&apos;aménagement, du logement et de la nature (DGALN) du ministère de la Transition
            écologique, de la biodiversité, de la forêt, de la mer et de la pêche, du ministère
            chargé du logement.
          </p>
          <p>
            Ministère en charge du logement
            <br />
            Direction générale de l&apos;aménagement, du logement et de la nature (DGALN)
            <br />
            Tour Séquoia
            <br />
            1 place Carpeaux
            <br />
            PUTEAUX
            <br />
            92055 PARIS LA DÉFENSE CEDEX
          </p>
          <ul>
            <li>
              Directeur de la publication : Philippe MAZENC, Directeur général de
              l&apos;Aménagement, du Logement et de la Nature (DGALN)
            </li>
            <li>
              Direction et coordination : Yoann LA CORTE, Sous-directeur de la législation de
              l&apos;habitat et des organismes de logement social.
            </li>
            <li>
              Maîtrise d&apos;ouvrage : Bureau de la réglementation des attributions des logements
              sociaux et du suivi du droit au logement opposable (DHUP/LO5).
            </li>
          </ul>

          <h2>Conception et développement</h2>
          <p>
            DAHLIA est un service numérique de l&apos;État. Il est développé au sein de{" "}
            <a href="https://beta.gouv.fr/incubateurs/mtes.html" className={fr.cx("fr-link")}>
              La Fabrique numérique
            </a>{" "}
            (incubateur du ministère de la Transition écologique) et propulsé par{" "}
            <a href="https://beta.gouv.fr" className={fr.cx("fr-link")}>
              beta.gouv.fr.
            </a>
          </p>

          <h2>Hébergement du site</h2>
          <p>
            Le site est hébergé par Scalingo SAS, sur un compte appartenant au ministère de la
            Transition écologique (MTE)&nbsp;:
          </p>
          <p>
            Scalingo SAS
            <br />
            13 rue Jacques Peirotes
            <br />
            67000 Strasbourg
            <br />
            France
          </p>
          <p>
            <a href="https://scalingo.com" className={fr.cx("fr-link")}>
              scalingo.com
            </a>
          </p>

          <h2>Propriété intellectuelle</h2>
          <p>
            À l&apos;exception de l&apos;iconographie et du graphisme, la reproduction des pages de
            ce site est autorisée à la condition d&apos;y mentionner la source. Elles ne peuvent
            être utilisées à des fins commerciales et publicitaires.
          </p>
          <p>
            Tout site public ou privé est autorisé à établir, sans autorisation préalable, un lien
            vers les informations diffusées sur le site de DAHLIA. En revanche, les pages du site
            DAHLIA ne doivent pas être imbriquées à l&apos;intérieur des pages d&apos;un autre site.
          </p>
          <p>
            L&apos;autorisation de mise en place d&apos;un lien est valable pour tout support, à
            l&apos;exception de ceux diffusant des informations à caractère polémique,
            pornographique, xénophobe ou pouvant, dans une plus large mesure, porter atteinte à la
            sensibilité du plus grand nombre.
          </p>
          <p>
            L&apos;éditeur se réserve le droit de demander la suppression d&apos;un lien qu&apos;il
            estime non conforme à l&apos;objet du site DAHLIA.
          </p>

          <h2>Responsabilité de l&apos;éditeur</h2>
          <p>
            Les informations et/ou documents figurant sur ce site et/ou accessibles par ce site
            proviennent de sources considérées comme fiables.
          </p>
          <p>
            Les informations et/ou documents disponibles sur ce site sont susceptibles d&apos;être
            modifiés à tout moment, et peuvent avoir fait l&apos;objet de mises à jour. En
            particulier, ils peuvent avoir fait l&apos;objet d&apos;une mise à jour entre le moment
            de leur téléchargement et celui où l&apos;utilisateur en prend connaissance.
            L&apos;ÉDITEUR ne pourra en aucun cas être tenu responsable de tout dommage de quelque
            nature qu&apos;il soit résultant de l&apos;interprétation ou de l&apos;utilisation des
            informations et/ou documents disponibles sur ce site.
          </p>

          <h2>Accès au site</h2>
          <p>
            L&apos;éditeur s&apos;efforce de permettre l&apos;accès au site 24 heures sur 24, 7
            jours sur 7, sauf en cas de force majeure ou d&apos;un événement hors du contrôle de
            l&apos;éditeur, et sous réserve des éventuelles pannes et interventions de maintenance
            nécessaires au bon fonctionnement du site et des services. Par conséquent,
            l&apos;éditeur ne peut garantir une disponibilité du site et/ou des services et des
            performances en termes de temps de réponse ou de qualité. La responsabilité de
            l&apos;éditeur ne saurait être engagée en cas d&apos;impossibilité d&apos;accès à ce
            site et/ou d&apos;utilisation des services. Par ailleurs, l&apos;éditeur peut être amené
            à interrompre le site ou une partie des services, à tout moment sans préavis, le tout
            sans droit à indemnités. L&apos;utilisateur reconnaît et accepte que l&apos;éditeur ne
            soit pas responsable des interruptions et des conséquences qui peuvent en découler pour
            l&apos;utilisateur ou tout tiers.
          </p>

          <h2>Modification des conditions d&apos;utilisation</h2>
          <p>
            L&apos;éditeur se réserve la possibilité de modifier, à tout moment et sans préavis, les
            présentes conditions d&apos;utilisation afin de les adapter aux évolutions du site et/ou
            de son exploitation.
          </p>

          <h2>Droit applicable</h2>
          <p>
            Le présent site ainsi que les modalités et conditions de son utilisation sont régis par
            le droit français, quel que soit le lieu d&apos;utilisation. En cas de contestation
            éventuelle et après l&apos;échec de toute tentative de recherche d&apos;une solution
            amiable, les tribunaux français seront seuls compétents pour connaître d&apos;éventuels
            litiges.
          </p>
        </div>
      </div>
    </div>
  );
}
