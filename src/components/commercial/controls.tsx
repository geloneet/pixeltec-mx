"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import type { CommercialSnapshot } from "@/lib/commercial/snapshot";
import type { BillingItem } from "@/types/documents";
import { CommercialModal } from "./modal";
import { commercialAction } from "./api";
import { balanceCents, money, dateLabel, projectStageLabel } from "./data";
import { commercialErrorLabel, deliveryLabel } from "./feedback";
type Data = CommercialSnapshot;
function useCommand(refresh: () => Promise<unknown>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function run(action: string, data: unknown) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await commercialAction(action, data);
      await refresh();
      if (result.status && !["sent", "delivered"].includes(result.status))
        throw new Error(
          "Envío " +
            (deliveryLabel[result.status] || result.status) +
            " · " +
            commercialErrorLabel(
              result.error || "Revisa el recibo antes de repetir.",
            ),
        );
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar.");
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run };
}
export function ClientCommercialActions({
  client,
  data,
  refresh,
}: {
  client: Data["contacts"][number];
  data: Data;
  refresh: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const command = useCommand(refresh);
  const emailConversation = data.conversations.find(
    (c) => c.clientId === client.id && c.channel === "email" && !c.matchReview,
  );
  return (
    <>
      <button className="cc-button quiet" onClick={() => setOpen(true)}>
        Nueva oportunidad
      </button>
      {emailConversation ? (
        <Link
          className="cc-button quiet"
          href={"/whatsapp?conversation=" + emailConversation.id}
        >
          Abrir correo
        </Link>
      ) : (
        <button
          className="cc-button quiet"
          disabled={command.busy}
          onClick={() =>
            command.run("email_conversation", { clientId: client.id })
          }
        >
          Preparar correo
        </button>
      )}
      {command.error && (
        <p className="cc-error" role="alert">
          {command.error}
        </p>
      )}
      {open && (
        <CommercialModal
          title="Nueva oportunidad"
          onClose={() => setOpen(false)}
          busy={command.busy}
        >
          <p className="cc-small cc-muted mb-4">{client.name}</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              if (
                await command.run("new_opportunity", {
                  clientId: client.id,
                  need: form.get("need"),
                })
              )
                setOpen(false);
            }}
          >
            <label className="cc-field">
              ¿Qué necesita?
              <textarea required name="need" maxLength={2000} />
            </label>
            {data.opportunities.some(
              (o) =>
                o.clientId === client.id &&
                !["ganado", "perdido"].includes(o.stage),
            ) && (
              <p className="cc-small cc-muted">
                El cliente ya tiene una venta abierta; se conserva su
                oportunidad actual.
              </p>
            )}
            {command.error && (
              <p className="cc-error" role="alert">
                {command.error}
              </p>
            )}
            <div className="cc-form-end">
              <button className="cc-button primary" disabled={command.busy}>
                Guardar oportunidad
              </button>
            </div>
          </form>
        </CommercialModal>
      )}
    </>
  );
}
export function ProjectCommercialActions({
  project: p,
  data,
  refresh,
}: {
  project: Data["projects"][number];
  data: Data;
  refresh: () => Promise<unknown>;
}) {
  const [view, setView] = useState<"preview" | "history" | null>(null);
  const key = useRef("");
  const command = useCommand(refresh);
  const contact = data.contacts.find((c) => c.id === p.clientId);
  const conversations = data.conversations.filter(
    (c) => c.clientId === p.clientId && !c.matchReview,
  );
  return (
    <>
      <button
        className="cc-button quiet"
        onClick={() => {
          key.current = crypto.randomUUID();
          setView("preview");
        }}
      >
        Compartir avance
      </button>
      <button className="cc-button quiet" onClick={() => setView("history")}>
        Historial
      </button>
      {view && (
        <CommercialModal
          title={
            view === "history"
              ? "Historial del proyecto"
              : "Así verá el avance tu cliente"
          }
          onClose={() => setView(null)}
          busy={command.busy}
        >
          {view === "history" ? (
            <>
              {data.activity
                .filter(
                  (a) =>
                    (a.metadata as { projectId?: string } | null)?.projectId ===
                    p.id,
                )
                .map((a) => {
                  const item = a.metadata as {
                    commercialStage?: keyof typeof projectStageLabel;
                    clientNote?: string;
                    nextStep?: string;
                    nextStepDue?: string;
                  } | null;
                  return (
                    <article className="cc-card mb-3" key={a.id}>
                      <strong>
                        {item?.commercialStage &&
                        projectStageLabel[item.commercialStage]
                          ? projectStageLabel[item.commercialStage]
                          : a.message}
                      </strong>
                      {item?.clientNote && (
                        <p className="cc-preview-text mt-2">
                          {item.clientNote}
                        </p>
                      )}
                      {item?.nextStep && (
                        <p className="cc-small mt-2">
                          Siguiente paso: {item.nextStep}{" "}
                          {item.nextStepDue
                            ? "· " + dateLabel(item.nextStepDue)
                            : ""}
                        </p>
                      )}
                      <p className="cc-small cc-muted">
                        {dateLabel(a.createdAt)} · {a.actorName}
                      </p>
                    </article>
                  );
                })}
            </>
          ) : (
            <>
              <div className="cc-card">
                <p className="cc-small cc-muted">{contact?.name}</p>
                <h3 className="mt-2 font-semibold">{p.name}</h3>
                <span className="cc-tag mt-3">
                  {p.revision
                    ? projectStageLabel[p.stage]
                    : "Etapa por confirmar"}
                </span>
                <p className="cc-preview-text">
                  {p.note || "Todavía no hay una nota publicada."}
                </p>
                <p>
                  Próximo paso: {p.nextStep || "Por definir"} ·{" "}
                  {dateLabel(p.due)}
                </p>
              </div>
              <p className="cc-small cc-muted my-4">
                {contact?.portalEnabled
                  ? "El cliente inicia sesión en su portal con el correo verificado."
                  : "Activa el portal desde la ficha del cliente para compartir su acceso."}
              </p>
              {conversations.length ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    if (
                      await command.run("share_project", {
                        id: p.id,
                        expectedRevision: p.revision,
                        conversationId: form.get("conversationId"),
                        idempotencyKey: key.current,
                      })
                    )
                      setView(null);
                  }}
                >
                  <label className="cc-field">
                    Canal del cliente
                    <select name="conversationId" required>
                      {conversations.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.channel} · {c.address} ·{" "}
                          {c.mode === "HUMAN"
                            ? "Humano"
                            : "Requiere atención humana"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="cc-small flex gap-2">
                    <input type="checkbox" required />
                    Revisé el avance y autorizo este envío al cliente.
                  </label>
                  <div className="cc-form-end">
                    <button
                      className="cc-button primary"
                      disabled={
                        command.busy ||
                        !contact?.portalEnabled ||
                        p.revision === 0
                      }
                    >
                      Confirmar envío del avance
                    </button>
                  </div>
                </form>
              ) : (
                <p className="cc-small cc-muted">
                  Prepara un correo desde Clientes o vincula su conversación de
                  WhatsApp.
                </p>
              )}
              <Link
                className="cc-button quiet"
                href={"/whatsapp?client=" + p.clientId}
              >
                Abrir conversación
              </Link>
            </>
          )}
          {command.error && (
            <p className="cc-error" role="alert">
              {command.error}
            </p>
          )}
        </CommercialModal>
      )}
    </>
  );
}
export function QuoteCommercialShare({
  quote: q,
  data,
  refresh,
}: {
  quote: Data["quotes"][number];
  data: Data;
  refresh: () => Promise<unknown>;
}) {
  const conversations = data.conversations.filter(
    (c) => c.clientId === q.clientId && !c.matchReview,
  );
  const command = useCommand(refresh);
  const key = useRef(crypto.randomUUID());
  return (
    <>
      {conversations.length ? (
        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            void command.run("share_quote", {
              id: q.id,
              expectedRevision: q.version,
              conversationId: form.get("conversationId"),
              idempotencyKey: key.current,
            });
          }}
        >
          <label className="cc-field">
            Compartir enlace protegido
            <select name="conversationId" required>
              {conversations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.channel} · {c.address} ·{" "}
                  {c.mode === "HUMAN" ? "Humano" : "Requiere atención humana"}
                </option>
              ))}
            </select>
          </label>
          <p className="cc-small cc-muted mb-3">
            Se enviará el folio {q.folio}, el título, la versión {q.version} y
            el enlace protegido a esta propuesta.
          </p>
          <label className="cc-small flex gap-2">
            <input type="checkbox" required />
            Revisé la cotización y autorizo este envío.
          </label>
          <div className="cc-form-end">
            <button className="cc-button primary" disabled={command.busy}>
              Confirmar envío de cotización
            </button>
          </div>
        </form>
      ) : (
        <p className="cc-small cc-muted mt-4">
          Prepara el correo del cliente o vincula su WhatsApp antes de
          compartir.
        </p>
      )}
      {command.error && (
        <p className="cc-error" role="status">
          {command.error}
        </p>
      )}
    </>
  );
}
export function BillingCommercialActions({
  bill: b,
  data,
  refresh,
}: {
  bill: BillingItem;
  data: Data;
  refresh: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const command = useCommand(refresh);
  const conversations = data.conversations.filter(
    (c) => c.clientId === b.clientId && !c.matchReview,
  );
  const reminder = data.reminders.find(
    (r) => r.billingItemId === b.id && r.duePeriod === b.dueDate,
  );
  return (
    <>
      {balanceCents(b) > 0 && (
        <button className="cc-button quiet" onClick={() => setOpen(true)}>
          Recordatorio
        </button>
      )}
      {open && (
        <CommercialModal
          title="Preparar recordatorio"
          onClose={() => setOpen(false)}
          busy={command.busy}
        >
          <p className="cc-small cc-muted">
            {b.clientName} · {b.concept}
            <br />
            Saldo: {money(balanceCents(b), b.currency)} · Vence{" "}
            {dateLabel(b.dueDate)}
          </p>
          {reminder && (
            <div className="cc-card my-4">
              <p>
                {reminder.status === "paused"
                  ? "En pausa"
                  : reminder.status === "sent"
                    ? "Enviado"
                    : reminder.status === "failed"
                      ? "Error de envío"
                      : reminder.status === "cancelled"
                        ? "Cancelado"
                        : "Programado"}{" "}
                · {new Date(reminder.scheduledAt).toLocaleString("es-MX")}
              </p>
              <p className="cc-preview-text">{reminder.body}</p>
              <div className="cc-actions">
                {["scheduled", "failed"].includes(reminder.status) && (
                  <button
                    className="cc-button"
                    disabled={command.busy}
                    onClick={() =>
                      command.run("pause_reminder", {
                        id: reminder.id,
                        revision: reminder.revision,
                      })
                    }
                  >
                    Pausar recordatorio
                  </button>
                )}
                {reminder.status === "scheduled" &&
                  new Date(reminder.scheduledAt).getTime() <= Date.now() && (
                    <button
                      className="cc-button primary"
                      disabled={command.busy}
                      onClick={() =>
                        command.run("send_reminder", { id: reminder.id })
                      }
                    >
                      Confirmar envío ahora
                    </button>
                  )}
              </div>
            </div>
          )}
          {(!reminder || ["paused", "cancelled"].includes(reminder.status)) &&
            (conversations.length ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  await command.run("reminder", {
                    billingItemId: b.id,
                    duePeriod: b.dueDate,
                    conversationId: form.get("conversationId"),
                    scheduledAt: new Date(
                      String(form.get("scheduledAt")),
                    ).toISOString(),
                    body: form.get("body"),
                  });
                }}
              >
                <label className="cc-field">
                  Canal
                  <select name="conversationId" required>
                    {conversations.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.channel} · {c.address} ·{" "}
                        {c.mode === "HUMAN"
                          ? "Humano"
                          : "Requiere atención humana"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="cc-field">
                  Mensaje introductorio
                  <textarea
                    name="body"
                    maxLength={3800}
                    required
                    defaultValue={
                      "Hola " +
                      b.clientName +
                      ", te comparto el saldo pendiente de " +
                      b.concept +
                      "."
                    }
                  />
                </label>
                <p className="cc-small cc-muted mb-3">
                  El saldo y vencimiento se agregan desde Cobros y se vuelven a
                  comprobar antes del envío.
                </p>
                <label className="cc-field">
                  Fecha y hora de envío
                  <input
                    name="scheduledAt"
                    type="datetime-local"
                    required
                    defaultValue={new Date(
                      Date.now() +
                        60000 -
                        new Date().getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)}
                  />
                </label>
                <label className="cc-small flex gap-2">
                  <input type="checkbox" required />
                  Revisé el mensaje y autorizo su programación.
                </label>
                <div className="cc-form-end">
                  <button className="cc-button primary" disabled={command.busy}>
                    Programar recordatorio
                  </button>
                </div>
              </form>
            ) : (
              <p className="cc-small cc-muted my-4">
                Prepara un correo en Clientes o vincula su conversación de
                WhatsApp.
              </p>
            ))}
          {command.error && (
            <p className="cc-error" role="alert">
              {command.error}
            </p>
          )}
          <Link
            className="cc-button quiet mt-3"
            href={"/whatsapp?client=" + b.clientId}
          >
            Abrir conversación
          </Link>
        </CommercialModal>
      )}
    </>
  );
}
