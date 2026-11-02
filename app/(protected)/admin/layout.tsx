import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fr } from "@codegouvfr/react-dsfr";
import { clientIpFrom, logSecurityDenial } from "@/app/lib/audit-log";
import { auth } from "@/app/lib/auth";
import { AdminSideMenu } from "@/app/ui/admin/admin-side-menu";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  // Validation is required in addition to the admin role, matching requireAdmin,
  // the protected layout, and case-file scope (defense in depth).
  if (!session?.user?.isValidated || !session.user.isAdmin) {
    const reason = !session?.user
      ? "unauthenticated"
      : !session.user.isValidated
        ? "not_validated"
        : "not_admin";
    logSecurityDenial({
      action: "auth.admin.denied",
      actorId: session?.user?.id ?? null,
      reason,
      ip: clientIpFrom(requestHeaders),
    });
    notFound();
  }

  return (
    <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters", "fr-mt-3w")}>
      <div className={fr.cx("fr-col-12", "fr-col-md-3")}>
        <AdminSideMenu />
      </div>
      <div className={fr.cx("fr-col-12", "fr-col-md-9")}>{children}</div>
    </div>
  );
}
