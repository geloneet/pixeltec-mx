import { NextResponse } from "next/server";
import { z } from "zod";
import { CommercialError } from "@/lib/commercial/access";
import { recordQuoteDecision } from "@/lib/commercial/quote-decisions";
import { enforceRateLimit } from "@/lib/rate-limit";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  if (!isCommercialOriginAllowed(request))
    return NextResponse.json(
      { error: "Origen no permitido." },
      { status: 403 },
    );
  const limit = await enforceRateLimit({
    bucket: "commercial_quote_decision",
    ip: request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown",
    max: 12,
    windowMs: 600_000,
    failClosed: true,
  });
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Espera unos minutos antes de reintentar." },
      { status: 429 },
    );
  try {
    const body = await request.text();
    if (body.length > 16000)
      return NextResponse.json(
        { error: "El formulario es demasiado largo." },
        { status: 413 },
      );
    const { token } = await context.params;
    return NextResponse.json(
      await recordQuoteDecision(token, JSON.parse(body)),
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof CommercialError
            ? error.code
            : error instanceof z.ZodError || error instanceof SyntaxError
              ? "Revisa los campos del formulario."
              : "No se pudo registrar la decisión.",
      },
      {
        status:
          error instanceof CommercialError
            ? error.status
            : error instanceof z.ZodError || error instanceof SyntaxError
              ? 400
              : 500,
      },
    );
  }
}
import { isCommercialOriginAllowed } from "@/lib/commercial/origin";
