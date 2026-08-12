import { redirect } from "next/navigation";
import { isSetupRequired } from "@/lib/pb";
import { SetupForm } from "./setup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!(await isSetupRequired())) {
    redirect("/login");
  }

  const params = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Zettelruhe einrichten</CardTitle>
          <CardDescription>
            Leere Instanz: lege die Eigentümer:in, die Firma und den
            Steuer-Modus fest.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SetupForm error={params.error ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}
