/**
 * Angebots-PDF über Next streamen (Superuser → PB Files).
 * Route unter /app/... (nicht /api/* — Caddy leitet /api an PB).
 */

import { NextResponse } from "next/server";
import { requireFirmaSession } from "@/lib/session";
import { getAngebotPdfResponse } from "@/modules/sales";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(
  _request: Request,
  context: { params: Params },
): Promise<Response> {
  let firmaId: string;
  try {
    const session = await requireFirmaSession();
    firmaId = session.firmaId;
  } catch {
    return NextResponse.redirect(
      new URL("/login", process.env.APP_URL || "http://localhost"),
    );
  }

  const { id } = await context.params;

  try {
    const { response, filename } = await getAngebotPdfResponse(firmaId, id);
    const contentType =
      response.headers.get("content-type") || "application/pdf";
    const body = await response.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "PDF nicht verfügbar.";
    if (msg.includes("nicht gefunden")) {
      return new NextResponse("Nicht gefunden", { status: 404 });
    }
    if (msg.includes("Kein PDF")) {
      return new NextResponse("Kein PDF", { status: 404 });
    }
    return new NextResponse(msg, { status: 400 });
  }
}
