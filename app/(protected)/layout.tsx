import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIpFrom, logSecurityDenial } from "@/app/lib/audit-log";
import { auth } from "@/app/lib/auth";
import { PendingValidation } from "@/app/ui/pending-validation";

// Access control for connected pages:
// - no valid session → redirect to /connexion ;
// - valid session but isValidated is false → pending validation message ;
// - otherwise → render the page.
export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    redirect("/connexion");
  }

  if (!session.user.isValidated) {
    logSecurityDenial({
      action: "auth.access.denied",
      actorId: session.user.id,
      reason: "not_validated",
      ip: clientIpFrom(requestHeaders),
    });
    return <PendingValidation />;
  }

  return <>{children}</>;
}
