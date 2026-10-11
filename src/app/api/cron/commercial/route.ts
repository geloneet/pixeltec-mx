import { timingSafeEqual } from "node:crypto";
import {
  assertCronExecutionAllowed,
  cronBlockedResponse,
} from "@/lib/cron-guard";
import { runCommercialWorker } from "@/lib/commercial/worker";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers
    .get("authorization")
    ?.replace(/^Bearer /, "");
  if (
    !expected ||
    !provided ||
    Buffer.byteLength(provided) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  )
    return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    assertCronExecutionAllowed();
    return Response.json(await runCommercialWorker());
  } catch (error) {
    return (
      cronBlockedResponse(error) ||
      Response.json({ error: "commercial_worker_failed" }, { status: 503 })
    );
  }
}
