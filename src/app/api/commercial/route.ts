import { NextResponse } from "next/server";
import { isCommercialOriginAllowed } from "@/lib/commercial/origin";
import { z } from "zod";
import {
  createCommercialContact,
  createOpportunityForClient,
  updateCommercialOpportunity,
  updateCommercialProject,
} from "@/lib/commercial/operations";
import { getCommercialSnapshot } from "@/lib/commercial/snapshot";
import { CommercialError } from "@/lib/commercial/access";
import { contactInput } from "@/lib/commercial/schemas";
import { recordCommercialPayment } from "@/lib/commercial/payments";
import {
  sendCommercialMessage,
  retryCommercialMessage,
  setCommercialMode,
  saveCommercialPolicy,
  linkCommercialConversation,
  synchronizeCommercialWhatsApp,
  verifyCommercialConnections,
} from "@/lib/commercial/inbox";
import {
  scheduleCommercialReminder,
  pauseCommercialReminder,
  sendCommercialReminderNow,
} from "@/lib/commercial/reminders";
import { synchronizeCommercialForms } from "@/lib/commercial/worker";
import {
  shareCommercialProject,
  shareCommercialQuote,
  openCommercialEmailConversation,
} from "@/lib/commercial/sharing";
export const dynamic = "force-dynamic";
function failure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof CommercialError
          ? error.code
          : error instanceof z.ZodError
            ? "Revisa los campos y las fechas."
            : "No se pudo completar la operación. Recarga y vuelve a intentarlo.",
    },
    {
      status:
        error instanceof CommercialError
          ? error.status
          : error instanceof z.ZodError
            ? 400
            : 500,
    },
  );
}
export async function GET() {
  try {
    return NextResponse.json(await getCommercialSnapshot(), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  if (!isCommercialOriginAllowed(request))
    return NextResponse.json(
      { error: "Origen no permitido." },
      { status: 403 },
    );
  try {
    const text = await request.text();
    if (text.length > 64000)
      return NextResponse.json(
        { error: "Datos demasiado largos." },
        { status: 413 },
      );
    const input = z
      .object({
        action: z.enum([
          "contact",
          "opportunity",
          "project",
          "new_opportunity",
          "payment",
          "message",
          "retry",
          "mode",
          "policy",
          "link",
          "sync_whatsapp",
          "sync_forms",
          "connections",
          "reminder",
          "pause_reminder",
          "send_reminder",
          "share_project",
          "share_quote",
          "email_conversation",
        ]),
        data: z.unknown(),
      })
      .strict()
      .parse(JSON.parse(text));
    let result: unknown;
    if (input.action === "contact")
      result = await createCommercialContact(input.data);
    else if (input.action === "opportunity")
      result = await updateCommercialOpportunity(input.data);
    else if (input.action === "project")
      result = await updateCommercialProject(input.data);
    else if (input.action === "payment")
      result = await recordCommercialPayment(input.data);
    else if (input.action === "message")
      result = await sendCommercialMessage(input.data);
    else if (input.action === "retry")
      result = await retryCommercialMessage(input.data);
    else if (input.action === "mode")
      result = await setCommercialMode(input.data);
    else if (input.action === "policy")
      result = await saveCommercialPolicy(input.data);
    else if (input.action === "link")
      result = await linkCommercialConversation(input.data);
    else if (input.action === "sync_whatsapp")
      result = await synchronizeCommercialWhatsApp(undefined, input.data);
    else if (input.action === "sync_forms")
      result = await synchronizeCommercialForms();
    else if (input.action === "connections")
      result = await verifyCommercialConnections();
    else if (input.action === "reminder")
      result = await scheduleCommercialReminder(input.data);
    else if (input.action === "pause_reminder")
      result = await pauseCommercialReminder(input.data);
    else if (input.action === "send_reminder")
      result = await sendCommercialReminderNow(input.data);
    else if (input.action === "share_project")
      result = await shareCommercialProject(input.data);
    else if (input.action === "share_quote")
      result = await shareCommercialQuote(input.data);
    else if (input.action === "email_conversation")
      result = await openCommercialEmailConversation(input.data);
    else {
      const data = contactInput
        .pick({ need: true })
        .extend({ clientId: z.string().uuid() })
        .strict()
        .parse(input.data);
      result = await createOpportunityForClient(data.clientId, data.need);
    }
    return NextResponse.json(result);
  } catch (error) {
    return failure(error);
  }
}
