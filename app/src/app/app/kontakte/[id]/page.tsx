import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFirmaSession } from "@/lib/session";
import {
  createAnsprechpartnerAction,
  deleteAnsprechpartnerAction,
  deleteKontaktAction,
  getKontakt,
  listAnsprechpartner,
  updateKontaktAction,
} from "@/modules/contacts";
import { KontaktForm } from "@/modules/contacts/kontakt-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string; saved?: string }>;

export default async function KontaktDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await requireFirmaSession();

  const { id } = await params;
  const sp = await searchParams;
  const kontakt = await getKontakt(session.firmaId, id);
  if (!kontakt) notFound();

  const ansprechpartner = await listAnsprechpartner(session.firmaId, id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href="/app/kontakte"
            className="hover:text-foreground hover:underline"
          >
            ← Kontakte
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          {kontakt.name}
        </h1>
        {sp.saved ? (
          <p className="mt-1 text-sm text-success">Gespeichert.</p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stammdaten</CardTitle>
          <CardDescription>Bearbeiten und speichern.</CardDescription>
        </CardHeader>
        <CardContent>
          <KontaktForm
            action={updateKontaktAction}
            kontakt={kontakt}
            submitLabel="Speichern"
            error={sp.error ?? null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ansprechpartner</CardTitle>
          <CardDescription>Optional, light v1.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ansprechpartner.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Ansprechpartner.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {ansprechpartner.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">{a.name}</p>
                    <p className="text-muted-foreground">
                      {[a.position, a.email, a.telefon]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                  <form action={deleteAnsprechpartnerAction}>
                    <input type="hidden" name="kontaktId" value={id} />
                    <input type="hidden" name="id" value={a.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Entfernen
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <form
            action={createAnsprechpartnerAction}
            className="grid gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-4 sm:grid-cols-2"
          >
            <input type="hidden" name="kontaktId" value={id} />
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="ap-name">Name</Label>
              <Input id="ap-name" name="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ap-position">Position</Label>
              <Input id="ap-position" name="position" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ap-email">E-Mail</Label>
              <Input id="ap-email" name="email" type="email" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ap-telefon">Telefon</Label>
              <Input id="ap-telefon" name="telefon" type="tel" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" variant="secondary" size="sm">
                Ansprechpartner hinzufügen
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Kontakt löschen</CardTitle>
          <CardDescription>
            Entfernt den Kontakt und zugehörige Ansprechpartner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={deleteKontaktAction}>
            <input type="hidden" name="id" value={id} />
            <Button type="submit" variant="danger" size="sm">
              Endgültig löschen
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
