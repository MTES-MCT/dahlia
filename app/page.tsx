import { StartDsfrOnHydration } from "../src/dsfr-bootstrap";
import { fr } from "@codegouvfr/react-dsfr";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <StartDsfrOnHydration />
      <h1 className={fr.cx("fr-mt-3w")}>Hello World</h1>
      <h2>Youhou</h2>
      <p> Ici, un paragraphe de présentation, des images si on veut…</p>

      <p>
        <Link href="/case_files">Visualiser les dossiers</Link>
      </p>
    </>
  );
}
