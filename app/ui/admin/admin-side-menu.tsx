"use client";

import { usePathname } from "next/navigation";
import { SideMenu } from "@codegouvfr/react-dsfr/SideMenu";

const ADMIN_ITEMS = [
  { text: "Utilisateurs", href: "/admin/users" },
  { text: "Juridiction", href: "/admin/jurisdiction" },
  { text: "Divisions", href: "/admin/divisions" },
] as const;

// Left navigation for the admin area (users, jurisdictions, divisions, …).
export function AdminSideMenu() {
  const pathname = usePathname();

  return (
    <SideMenu
      burgerMenuButtonText="Menu administration"
      title="Administration"
      sticky
      items={ADMIN_ITEMS.map((item) => ({
        text: item.text,
        isActive: pathname === item.href || pathname.startsWith(`${item.href}/`),
        linkProps: { href: item.href },
      }))}
    />
  );
}
