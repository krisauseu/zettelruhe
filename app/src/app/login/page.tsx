import { redirect } from "next/navigation";
import { isSetupRequired } from "@/lib/pb";
import { LoginForm } from "./login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isSetupRequired()) {
    redirect("/setup");
  }

  const params = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Anmelden</CardTitle>
          <CardDescription>
            Melde dich als Eigentümer:in bei Zettelruhe an.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm error={params.error ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}
