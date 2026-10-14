"use client";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Mail, MessageCircle, FileText } from "lucide-react";
import type { CommercialSnapshot } from "@/lib/commercial/snapshot";
import { approvedReply } from "@/lib/commercial/policy";
import { loadCommercialThread } from "./thread";
import { commercialAction } from "./api";
import { CommercialModal } from "./modal";
import { dateLabel, initials } from "./data";
import { commercialErrorLabel, deliveryLabel } from "./feedback";
type Conversation = CommercialSnapshot["conversations"][number];
const states = {
  sin_atender: "Sin atender",
  decision: "Necesitan tu decisión",
  esperando: "Esperando respuesta",
  humano: "Atención humana",
};
export function CommercialInbox({
  data: d,
  refresh,
}: {
  data: CommercialSnapshot;
  refresh: () => Promise<unknown>;
}) {
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailCursor, setEmailCursor] = useState<string | null>(null);
  const saving = useRef(false);
  const [confirm, setConfirm] = useState(false);
  const [link, setLink] = useState(false);
  const key = useRef("");
  const c = d.conversations.find((c) => c.id === selected);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const match = d.conversations.find(
      (c) =>
        c.id === params.get("conversation") ||
        c.clientId === params.get("client"),
    );
    if (!selected) setSelected(match?.id || d.conversations[0]?.id || "");
  }, [d.conversations, selected]);
  useEffect(() => {
    setBody("");
    key.current = crypto.randomUUID();
  }, [selected]);
  const {
    data: thread,
    error,
    mutate: refreshThread,
    isLoading,
  } = useSWR(
    c ? "/api/commercial/conversations/" + c.id : null,
    loadCommercialThread,
    { refreshInterval: 15000 },
  );
  async function run(action: string, input: unknown) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setNotice("");
    try {
      const result = await commercialAction(action, input);
      await refresh();
      await refreshThread();
      if (action === "sync_email") {
        setEmailCursor(result.nextCursor);
        setNotice(
          `${result.imported} correo${result.imported === 1 ? "" : "s"} nuevo${result.imported === 1 ? "" : "s"}.${result.nextCursor ? " Hay más correos anteriores por revisar." : " Revisión terminada."}`,
        );
      } else if (
        result.status &&
        !["sent", "delivered"].includes(result.status)
      )
        setNotice(
          "Envío " +
            (deliveryLabel[result.status] || result.status) +
            ": " +
            commercialErrorLabel(
              result.error || "Comprueba el recibo antes de repetir.",
            ),
        );
      else setNotice("Cambio guardado.");
      if (
        action === "message" &&
        ["sent", "delivered"].includes(result.status)
      ) {
        setBody("");
        key.current = crypto.randomUUID();
      }
      setConfirm(false);
      setLink(false);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "No se pudo completar.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const last = thread?.messages.filter((m) => m.direction === "inbound").at(-1);
  const draft = last
    ? approvedReply({
        body: last.body,
        enabled: true,
        mode: "BOT",
        needsReview: !!c?.matchReview,
        answers: d.policy.approvedAnswers,
      })
    : null;
  const channelLabel =
    c?.channel === "whatsapp"
      ? "WhatsApp"
      : c?.channel === "form"
        ? "Formulario"
        : "Correo";
  const client = d.contacts.find((row) => row.id === c?.clientId);
  const nextSale = d.opportunities.find(
    (o) =>
      o.clientId === c?.clientId &&
      !["ganado", "perdido", "pausado"].includes(o.stage),
  );
  return (
    <>
      <div className="cc-toolbar">
        <input
          className="cc-input"
          aria-label="Buscar conversaciones"
          placeholder="Buscar cliente o conversación…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="cc-actions">
          {d.user.role === "admin" && (
            <button
              className="cc-button"
              disabled={busy}
              onClick={() =>
                run("sync_email", emailCursor ? { after: emailCursor } : {})
              }
            >
              {emailCursor ? "Revisar correos anteriores" : "Recibir correos"}
            </button>
          )}
          <button
            className="cc-button"
            disabled={busy}
            onClick={() => run("sync_forms", {})}
          >
            Recibir formularios
          </button>
          <button
            className="cc-button"
            disabled={busy}
            onClick={() => run("sync_whatsapp", {})}
          >
            Actualizar WhatsApp
          </button>
        </div>
      </div>
      {notice && (
        <p className="cc-error" role="status">
          {notice}
        </p>
      )}
      <div className="cc-inbox">
        <aside className={"cc-thread-list" + (c ? " has-selection" : "")}>
          <div className="cc-choice">
            <button
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              Todos
            </button>
            <button
              aria-pressed={filter === "decision"}
              onClick={() => setFilter("decision")}
            >
              Por decidir
            </button>
          </div>
          {Object.entries(states).map(([state, label]) => {
            const rows = d.conversations.filter(
              (c) =>
                c.state === state &&
                (filter === "all" || state === filter) &&
                (
                  c.address +
                  " " +
                  d.contacts.find((client) => client.id === c.clientId)?.name +
                  " " +
                  c.subject
                )
                  .toLowerCase()
                  .includes(search.toLowerCase()),
            );
            return rows.length ? (
              <section key={state}>
                <h2 className="cc-kicker mt-5 mb-3">
                  {label} · {rows.length}
                </h2>
                {rows.map((row) => (
                  <button
                    title={row.subject || row.address}
                    key={row.id}
                    className={
                      "cc-thread-item" +
                      (row.id === selected ? " selected" : "")
                    }
                    aria-pressed={row.id === selected}
                    onClick={() => setSelected(row.id)}
                  >
                    <span className="cc-avatar cc-thread-avatar">
                      {initials(
                        d.contacts.find((client) => client.id === row.clientId)
                          ?.name || row.address,
                      )}
                    </span>
                    <span>
                      <strong>
                        {d.contacts.find((client) => client.id === row.clientId)
                          ?.name || row.address}
                      </strong>
                      <small>
                        {row.channel === "whatsapp"
                          ? "WhatsApp"
                          : row.channel === "form"
                            ? "Formulario"
                            : "Correo"}{" "}
                        · {dateLabel(row.lastInboundAt)}
                      </small>
                      <small>
                        {row.matchReview
                          ? "Verifica el contacto"
                          : row.subject || states[row.state]}
                      </small>
                    </span>
                  </button>
                ))}
              </section>
            ) : null;
          })}
          {!d.conversations.length && (
            <p className="cc-small cc-muted mt-5">
              Los mensajes aparecerán al recibir formularios, sincronizar
              PixelBot o conectar el webhook firmado de correo.
            </p>
          )}
        </aside>
        <section className="cc-thread" aria-label="Conversación seleccionada">
          {c ? (
            <>
              <header className="cc-thread-head">
                <div className="cc-thread-identity">
                  <span className="cc-avatar">
                    {initials(client?.name || c.address)}
                  </span>
                  <div>
                    <h2>
                      {d.contacts.find((client) => client.id === c.clientId)
                        ?.name || c.address}
                    </h2>
                    <p className="cc-small cc-muted">
                      {c.address} · {states[c.state]}
                    </p>
                  </div>
                </div>
                <span className="cc-tag">
                  {c.mode === "BOT"
                    ? "Asistente aprobado"
                    : c.mode === "PAUSED"
                      ? "En pausa"
                      : "Humano"}
                </span>
              </header>
              <div className="cc-actions cc-thread-controls">
                {c.clientId && (
                  <Link
                    href={
                      "/clientes/" +
                      (d.contacts.find((client) => client.id === c.clientId)
                        ?.publicId || c.clientId)
                    }
                    className="cc-button quiet"
                  >
                    Ver cliente
                  </Link>
                )}
                <button
                  className="cc-button"
                  disabled={busy || c.mode === "HUMAN"}
                  onClick={() =>
                    run("mode", {
                      id: c.id,
                      revision: c.revision,
                      mode: "HUMAN",
                    })
                  }
                >
                  Atención humana
                </button>
                <button
                  className="cc-button quiet"
                  disabled={busy || c.mode === "PAUSED"}
                  onClick={() =>
                    run("mode", {
                      id: c.id,
                      revision: c.revision,
                      mode: "PAUSED",
                    })
                  }
                >
                  Pausar
                </button>
                <button
                  className="cc-button quiet"
                  disabled={busy || c.mode === "BOT"}
                  onClick={() => {
                    if (
                      window.confirm(
                        "¿Reactivar las respuestas aprobadas para esta conversación?",
                      )
                    )
                      void run("mode", {
                        id: c.id,
                        revision: c.revision,
                        mode: "BOT",
                      });
                  }}
                >
                  Reactivar asistente
                </button>
              </div>
              <div className="cc-thread-context">
                <span className="cc-channel-label">
                  {c.channel === "whatsapp" ? (
                    <MessageCircle size={14} />
                  ) : c.channel === "form" ? (
                    <FileText size={14} />
                  ) : (
                    <Mail size={14} />
                  )}{" "}
                  {channelLabel}
                </span>
                <strong title={c.subject}>
                  {c.subject || "Conversación con el cliente"}
                </strong>
                <span>
                  {thread ? `${thread.messages.length} mensajes` : "Historial"}
                </span>
              </div>
              {nextSale?.nextAction && (
                <details className="cc-thread-sale">
                  <summary>Próximo paso: {nextSale.nextAction}</summary>
                  <p>
                    {nextSale.need} · {dateLabel(nextSale.nextActionDue)}
                  </p>
                  <Link href="/ventas" className="cc-button quiet">
                    Abrir Ventas
                  </Link>
                </details>
              )}
              {c.matchReview && (
                <div className="cc-error">
                  Este identificador coincide con un contacto sin verificar.{" "}
                  <button
                    className="cc-button mt-3"
                    onClick={() => setLink(true)}
                  >
                    Revisar y vincular contacto
                  </button>
                </div>
              )}
              <div className="cc-messages" aria-live="polite">
                {isLoading && <p role="status">Cargando historial…</p>}
                {!isLoading && !error && thread?.messages.length === 0 && (
                  <p className="cc-muted cc-small">
                    Todavía no hay mensajes en esta conversación.
                  </p>
                )}
                {error && (
                  <div className="cc-error">
                    {error.message}
                    <button
                      className="cc-button mt-3"
                      onClick={() => refreshThread()}
                    >
                      Reintentar
                    </button>
                  </div>
                )}
                {thread?.messages.map((m) => (
                  <article className={"cc-bubble " + m.direction} key={m.id}>
                    <div className="cc-bubble-author">
                      {m.direction === "inbound"
                        ? client?.contactName || client?.name || "Cliente"
                        : "PixelTEC"}
                    </div>
                    <p>{m.body}</p>
                    <small>
                      {dateLabel(m.createdAt)} ·{" "}
                      {new Intl.DateTimeFormat("es-MX", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "America/Mexico_City",
                      }).format(new Date(m.createdAt))}{" "}
                      ·{" "}
                      {m.direction === "inbound"
                        ? "Recibido"
                        : m.delivery === "sent"
                          ? "Aceptado por proveedor"
                          : m.delivery === "delivered"
                            ? "Entregado"
                            : m.delivery === "failed"
                              ? "Error de entrega"
                              : deliveryLabel[m.delivery] || "Sin confirmación"}
                    </small>
                  </article>
                ))}
              </div>
              {d.outbox
                .filter(
                  (o) =>
                    o.conversationId === c.id &&
                    ["failed", "unknown", "sending"].includes(o.status),
                )
                .map((o) => (
                  <div className="cc-error" key={o.id}>
                    <p>
                      Envío {deliveryLabel[o.status] || "Sin confirmación"} ·{" "}
                      {commercialErrorLabel(
                        o.errorCode || "Sin recibo confirmado",
                      )}
                    </p>
                    <button
                      className="cc-button mt-2"
                      disabled={busy}
                      onClick={() => run("retry", { id: o.id })}
                    >
                      Revisar reintento seguro
                    </button>
                  </div>
                ))}
              <div className="cc-composer">
                <div className="cc-row-head">
                  <label htmlFor="commercial-draft">Tu respuesta</label>
                  {draft?.reply && (
                    <button
                      className="cc-button quiet"
                      onClick={() => setBody(draft.reply!)}
                    >
                      Usar respuesta aprobada
                    </button>
                  )}
                </div>
                {last && !draft?.reply && (
                  <p className="cc-small cc-muted">
                    Esta consulta requiere criterio humano. El asistente no
                    tiene una respuesta aprobada.
                  </p>
                )}
                <textarea
                  id="commercial-draft"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={4096}
                  placeholder="Escribe y revisa tu respuesta…"
                  disabled={c.matchReview}
                />
                <div className="cc-form-end">
                  <span className="cc-small cc-muted">
                    {c.mode === "HUMAN"
                      ? "Bot pausado para esta conversación."
                      : "Activa atención humana para responder."}
                  </span>
                  <button
                    className="cc-button primary"
                    disabled={
                      busy ||
                      !body.trim() ||
                      c.mode !== "HUMAN" ||
                      c.matchReview
                    }
                    onClick={() => setConfirm(true)}
                  >
                    Revisar envío
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="cc-empty">
              <h2>Elige una conversación</h2>
              <p>
                Conserva el contexto del cliente y responde desde sus canales
                conectados.
              </p>
            </div>
          )}
        </section>
      </div>
      {confirm && c && (
        <CommercialModal
          title="Confirmar respuesta"
          onClose={() => setConfirm(false)}
          busy={busy}
        >
          <p className="cc-small cc-muted">
            Para {c.address} · {c.channel}
          </p>
          <p className="cc-preview-text">{body}</p>
          <div className="cc-form-end">
            <button className="cc-button" onClick={() => setConfirm(false)}>
              Volver al borrador
            </button>
            <button
              className="cc-button primary"
              disabled={busy}
              onClick={() =>
                run("message", {
                  conversationId: c.id,
                  idempotencyKey: key.current,
                  body,
                  subject: c.subject,
                })
              }
            >
              {busy ? "Enviando…" : "Confirmar envío"}
            </button>
          </div>
        </CommercialModal>
      )}
      {link && c && (
        <CommercialModal
          title="Verificar el contacto"
          onClose={() => setLink(false)}
          busy={busy}
        >
          <p className="cc-small cc-muted">
            Comprueba fuera del mensaje que {c.address} pertenece a este
            contacto. El mensaje no autoriza acceso a información privada.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void run("link", {
                id: c.id,
                revision: c.revision,
                clientId: form.get("clientId"),
                confirmed: true,
              });
            }}
          >
            <label className="cc-field">
              Contacto de tu cartera
              <select name="clientId" required>
                <option value="">Elige un contacto</option>
                {d.contacts.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} · {client.email || client.phone}
                  </option>
                ))}
              </select>
            </label>
            <label className="cc-small flex gap-2">
              <input type="checkbox" required />
              Verifiqué la identidad y confirmo esta vinculación.
            </label>
            <div className="cc-form-end">
              <button className="cc-button primary" disabled={busy}>
                Confirmar vínculo
              </button>
            </div>
          </form>
        </CommercialModal>
      )}
    </>
  );
}
