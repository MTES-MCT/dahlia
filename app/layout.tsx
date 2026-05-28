import type { Metadata } from "next";
import "./globals.css";
import { getHtmlAttributes, DsfrHead } from "../src/dsfr-bootstrap/server-only-index";
import { DsfrProvider } from "../src/dsfr-bootstrap";
import { StartDsfrOnHydration } from "../src/dsfr-bootstrap";

import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { Header } from "@codegouvfr/react-dsfr/Header";
import { Footer } from "@codegouvfr/react-dsfr/Footer";
import clsx from "clsx";

export const metadata: Metadata = {
  title: "DAHL'ia (Ministères du logement)",
  description: "Aide au traitement des contentieux du droit au logement et à l'hébergement",
};

import { fr } from "@codegouvfr/react-dsfr";

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = undefined; // Can be "fr" or "en" ...
  return (
    <html
      {...getHtmlAttributes({ lang })}
    >
      <head>
        <DsfrHead 
          preloadFonts={[
            //"Marianne-Light",
            //"Marianne-Light_Italic",
            "Marianne-Regular",
            //"Marianne-Regular_Italic",
            "Marianne-Medium",
            //"Marianne-Medium_Italic",
            "Marianne-Bold",
            //"Marianne-Bold_Italic",
            //"Spectral-Regular",
            //"Spectral-ExtraBold",
          ]}
        />
      </head>
      <body className={clsx("min-h-dvh","flex","flex-col")}>
        <StartDsfrOnHydration />
        <Header 
          brandTop={<>République<br />Française</>}
          homeLinkProps={{
            href: '/',
            title: "Accueil - DAHL'ia (Ministères du logement)"
          }}
          id="fr-header-simple-header-with-service-title-and-tagline"
          serviceTagline="Aide au traitement des contentieux du droit au logement et à l'hébergement"
          serviceTitle={<>DAHLIA{' '}<Badge as="span" noIcon severity="success">Beta</Badge></>}
        />

        <DsfrProvider lang={lang}>
          <main className={`${fr.cx('fr-container')} ${clsx("flex-1")}`}>
            {children}
          </main>
        </DsfrProvider>

        <Footer
          accessibility="non compliant"
          contentDescription="
            Ce message est à remplacer par les informations de votre site.

            Comme exemple de contenu, vous pouvez indiquer les informations 
            suivantes : Le site officiel d’information administrative pour les entreprises.
            Retrouvez toutes les informations et démarches administratives nécessaires à la création, 
            à la gestion et au développement de votre entreprise.
            "
          termsLinkProps={{
            href: '#'
          }}
          websiteMapLinkProps={{
            href: '#'
          }}
        />
      </body>
    </html>
  );
}
