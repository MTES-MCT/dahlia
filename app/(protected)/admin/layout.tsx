import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/app/lib/auth";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.isAdmin) {
    notFound();
  }

  return <>{children}</>;
}
