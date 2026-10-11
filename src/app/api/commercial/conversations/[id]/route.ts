import { getCommercialThread } from "@/lib/commercial/inbox";
import { CommercialError } from "@/lib/commercial/access";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return Response.json(
      { messages: await getCommercialThread((await params).id) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof CommercialError
            ? error.code
            : "No se pudo consultar el historial. Revisa la conexión y reintenta.",
      },
      { status: error instanceof CommercialError ? error.status : 503 },
    );
  }
}
