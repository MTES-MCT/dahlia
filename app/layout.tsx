import type { Metadata } from "next";
import "./globals.css";
import { getHtmlAttributes, DsfrHead } from "../src/dsfr-bootstrap/server-only-index";
import { DsfrProvider } from "../src/dsfr-bootstrap";
import { StartDsfrOnHydration } from "../src/dsfr-bootstrap";

import { Footer } from "@codegouvfr/react-dsfr/Footer";
import clsx from "clsx";
import { headers } from "next/headers";
import { auth } from "@/app/lib/auth";
import { EnvironmentBanner } from "@/app/ui/header/environment-banner";
import { HeaderDahlia } from "@/app/ui/header/header-dahlia";
import { NONCE_HEADER } from "@/app/lib/security-headers";

export const metadata: Metadata = {
  // Each route sets its own `title`, always suffixed with the app name (RGAA 8.5/8.6).
  title: {
    default: "DAHLIA",
    template: "%s - DAHLIA",
  },
  description:
    "Aide au traitement des contentieux du droit au logement et à l'hébergement opposable",
};

import { fr } from "@codegouvfr/react-dsfr";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Default language of the application, exposed as <html lang="fr"> (RGAA 8.3).
  const lang = "fr";

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  const user = session?.user;

  // CSP nonce minted by proxy.ts, so react-dsfr can stamp its inline scripts.
  const nonce = requestHeaders.get(NONCE_HEADER) ?? undefined;

  return (
    <html {...getHtmlAttributes({ lang })}>
      <head>
        <DsfrHead
          nonce={nonce}
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
      <body className={clsx("min-h-dvh", "flex", "flex-col")}>
        <StartDsfrOnHydration />
        <EnvironmentBanner environment={process.env.ENVIRONMENT} />
        <HeaderDahlia user={user} />

        <DsfrProvider lang={lang} doCheckNonce={nonce !== undefined}>
          <main className={`${fr.cx("fr-mx-3w")} ${clsx("flex-1")}`}>{children}</main>
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
            href: "#",
          }}
          websiteMapLinkProps={{
            href: "#",
          }}
        />
      </body>
    </html>
  );
}
