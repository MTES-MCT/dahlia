import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fr } from "@codegouvfr/react-dsfr";
import { auth } from "@/app/lib/auth";
import { AdminSideMenu } from "@/app/ui/admin/admin-side-menu";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.isAdmin) {
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
