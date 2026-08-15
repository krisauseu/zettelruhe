import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isSetupRequired, listFirmen, resolveAktiveFirmaId } from "@/lib/pb";
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

  const firmen = await listFirmen().catch(() => []);
  const firmaId = await resolveAktiveFirmaId(session.firmaId);

  return (
    <AppShell
      session={{ ...session, firmaId }}
      firmen={firmen}
    >
      {children}
    </AppShell>
  );
}
