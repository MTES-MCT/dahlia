import { StartDsfrOnHydration } from "../src/dsfr-bootstrap";
import { fr } from "@codegouvfr/react-dsfr";
import Link  from "next/link";

export default function Home() {
  return (
    <>
      <StartDsfrOnHydration />
      <h1 className={fr.cx('fr-mt-3w')}>Hello World</h1>
      <h2>Youhou</h2>
      <p> Ici, un paragraphe de présentation, des images si on veut…</p>

      <p>Aller sur le dashboard <Link href="/dashboard">ici</Link></p>
    </>
  );
}
