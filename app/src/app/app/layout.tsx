import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isSetupRequired } from "@/lib/pb";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function ProtectedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (await isSetupRequired()) {
    redirect("/setup");
  }

  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <AppShell session={session}>{children}</AppShell>;
}
