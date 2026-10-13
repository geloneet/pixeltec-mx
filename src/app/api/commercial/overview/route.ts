import { NextResponse } from "next/server";
import {
  CommercialError,
  requireCommercialAccess,
} from "@/lib/commercial/access";
import { getHoyDashboard } from "@/lib/hoy/dashboard";

export async function GET() {
  try {
    const session = await requireCommercialAccess();
    // Reutilizar las fuentes originales de Inicio. La bandeja consulta sus
    // hilos por separado: aquí no se llama otra vez al historial PixelBot.
    const overview = await getHoyDashboard(session.userId, new Date(), {
      vista: "hoy",
      actividad: "todas",
      canConversations: false,
    });
    return NextResponse.json(overview, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof CommercialError)
      return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json(
      { error: "No se pudo cargar el resumen de Inicio." },
      { status: 503 },
    );
  }
}
