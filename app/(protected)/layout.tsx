import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/app/lib/auth";
import { PendingValidation } from "@/app/ui/pending-validation";

// Access control for connected pages:
// - no valid session → redirect to /connexion ;
// - valid session but account not validated → pending validation message ;
// - otherwise → render the page.
export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/connexion");
  }

  if (!session.user.validated) {
    return <PendingValidation />;
  }

  return <>{children}</>;
}
