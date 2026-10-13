"use client";
import "./home.css";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowUpRight, ChevronRight, Mail, MessageCircle } from "lucide-react";
import type { CommercialSnapshot } from "@/lib/commercial/snapshot";
import type { BillingItem } from "@/types/documents";
import {
  balanceCents,
  dateLabel,
  money,
  saleStageLabel,
  saleStages,
  todayCivil,
} from "./data";
import type { HoyDashboard } from "@/lib/hoy/types";
import { HomeKpis, HomeActivity, HomeSecondary } from "./home-widgets";
import { loadCommercialThread } from "./thread";

type Conversation = CommercialSnapshot["conversations"][number];
type Opportunity = CommercialSnapshot["opportunities"][number];
type Decision = CommercialSnapshot["decisions"][number];
type Channel = "all" | "email" | "whatsapp";

function MessageRow({
  conversation: c,
  name,
}: {
  conversation: Conversation;
  name: string;
}) {
  const { data, error, isLoading } = useSWR(
    "/api/commercial/conversations/" + c.id,
    loadCommercialThread,
    { refreshInterval: 30000, shouldRetryOnError: false },
  );
  const last = data?.messages.reduce<
    (typeof data.messages)[number] | undefined
  >(
    (latest, message) =>
      !latest || message.createdAt > latest.createdAt ? message : latest,
    undefined,
  );
  const date = last?.createdAt || c.lastInboundAt;
  return (
    <Link className="cc-mail-row" href={"/whatsapp?conversation=" + c.id}>
      <span
        className="cc-mail-channel"
        title={c.channel === "email" ? "Correo" : "WhatsApp"}
      >
        {c.channel === "email" ? (
          <Mail size={18} />
        ) : (
          <MessageCircle size={18} />
        )}
      </span>
      <div className="cc-mail-content">
        <div className="cc-mail-heading">
          <strong>{name}</strong>
          {date && (
            <time dateTime={date}>
              {dateLabel(date)} ·{" "}
              {new Intl.DateTimeFormat("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZone: "America/Mexico_City",
              }).format(new Date(date))}
            </time>
          )}
        </div>
        {c.channel === "email" && c.subject && (
          <p className="cc-mail-subject">{c.subject}</p>
        )}
        <p className="cc-mail-preview">
          {error ? (
            "Vista previa no disponible. Abre la conversación para revisar."
          ) : isLoading ? (
            "Cargando mensaje…"
          ) : last ? (
            <>
              {last.direction === "outbound" && "Tú: "}
              {last.body}
            </>
          ) : (
            "Todavía no hay mensajes en esta conversación."
          )}
        </p>
        <div className="cc-mail-meta">
          <span>{c.channel === "email" ? "Correo" : "WhatsApp"}</span>
          {c.state === "sin_atender" && (
            <span className="cc-attention">Por atender</span>
          )}
          {c.state === "decision" && (
            <span className="cc-attention">Requiere tu decisión</span>
          )}
          {c.matchReview && <span>Identidad por confirmar</span>}
        </div>
      </div>
      <ArrowUpRight size={15} className="cc-mail-open" aria-hidden />
    </Link>
  );
}

export function CommercialHome({
  data: d,
  pending,
  overview,
  overviewError,
  refreshOverview,
  decisions,
  onOpportunity,
  onDecision,
  onPayment,
}: {
  data: CommercialSnapshot;
  overview?: HoyDashboard;
  overviewError?: boolean;
  refreshOverview?: () => Promise<unknown>;
  pending: Opportunity[];
  decisions: Decision[];
  onOpportunity: (row: Opportunity) => void;
  onDecision: (row: Decision) => void;
  onPayment: (row: BillingItem) => void;
}) {
  const [channel, setChannel] = useState<Channel>("all");
  const [moreMessages, setMoreMessages] = useState(false);
  const [allPriorities, setAllPriorities] = useState(false);
  const contact = (id: string | null) => d.contacts.find((c) => c.id === id);
  const today = todayCivil();
  const conversations = d.conversations
    .filter((c) => ["email", "whatsapp"].includes(c.channel))
    .sort((a, b) =>
      (b.lastInboundAt || b.updatedAt).localeCompare(
        a.lastInboundAt || a.updatedAt,
      ),
    );
  const filtered = conversations.filter(
    (c) => channel === "all" || c.channel === channel,
  );
  const followups = pending.filter(
    (o) => o.nextActionDue && o.nextActionDue <= today,
  );
  const overdue = d.bills
    .filter((b) => balanceCents(b) > 0 && b.dueDate < today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const priorities: {
    id: string;
    label: string;
    name: string;
    detail: string;
    action: ReactNode;
  }[] = [
    ...decisions.map((a) => {
      const q = d.quotes.find((q) => q.id === a.quoteId)!;
      return {
        id: a.id,
        label: "Cotización por revisar",
        name: contact(q.clientId)?.name || q.title,
        detail: `${a.actorName} ${a.decision === "accept" ? "aceptó" : "solicitó cambios en"} la versión ${a.version}.`,
        action: (
          <button className="cc-text-action" onClick={() => onDecision(a)}>
            {a.decision === "accept" ? "Confirmar venta" : "Revisar cambios"}
            <ChevronRight size={14} />
          </button>
        ),
      };
    }),
    ...d.conversations
      .filter((c) => c.state === "decision")
      .map((c) => ({
        id: c.id,
        label: "Conversación por revisar",
        name: contact(c.clientId)?.name || c.subject || c.address,
        detail: c.matchReview
          ? "Confirma a quién pertenece este contacto."
          : "Necesita tu decisión para continuar.",
        action: (
          <Link
            className="cc-text-action"
            href={"/whatsapp?conversation=" + c.id}
          >
            Abrir conversación
            <ChevronRight size={14} />
          </Link>
        ),
      })),
    ...overdue.map((b) => ({
      id: b.id,
      label: "Pago vencido · " + dateLabel(b.dueDate),
      name: contact(b.clientId)?.name || "Cliente",
      detail: money(balanceCents(b), b.currency),
      action: (
        <button className="cc-text-action" onClick={() => onPayment(b)}>
          Registrar pago
          <ChevronRight size={14} />
        </button>
      ),
    })),
    ...followups.map((o) => ({
      id: o.id,
      label: "Seguimiento · " + dateLabel(o.nextActionDue),
      name: contact(o.clientId)?.name || "Contacto",
      detail: o.nextAction || o.need,
      action: (
        <button className="cc-text-action" onClick={() => onOpportunity(o)}>
          Revisar seguimiento
          <ChevronRight size={14} />
        </button>
      ),
    })),
  ];

  return (
    <div className="cc-home">
      <HomeKpis overview={overview} error={overviewError} data={d} />
      {overviewError && (
        <p role="alert" className="cc-overview-error">
          No se pudieron cargar los indicadores y la actividad.{" "}
          <button onClick={refreshOverview}>Reintentar</button>
        </p>
      )}

      <div className="cc-home-layout">
        <div className="cc-home-main">
          <section className="cc-home-panel" aria-labelledby="home-inbox-title">
            <div className="cc-home-panel-head">
              <div>
                <span className="cc-section-number">01 / MENSAJES</span>
                <h2 id="home-inbox-title">Bandeja de entrada</h2>
                <p>Últimas conversaciones de correo y WhatsApp</p>
              </div>
              <Link className="cc-text-action" href="/whatsapp">
                Abrir bandeja
                <ArrowUpRight size={14} />
              </Link>
            </div>
            <div
              className="cc-mail-filters"
              role="group"
              aria-label="Canal de la bandeja"
            >
              {(
                [
                  ["all", "Todos"],
                  ["email", "Correo"],
                  ["whatsapp", "WhatsApp"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  aria-pressed={channel === key}
                  onClick={() => {
                    setChannel(key);
                    setMoreMessages(false);
                  }}
                >
                  {label}
                  <span>
                    {
                      conversations.filter(
                        (c) => key === "all" || c.channel === key,
                      ).length
                    }
                  </span>
                </button>
              ))}
            </div>
            <div className="cc-mail-list">
              {filtered.slice(0, moreMessages ? 8 : 4).map((c) => (
                <MessageRow
                  key={c.id}
                  conversation={c}
                  name={
                    contact(c.clientId)?.name ||
                    c.address ||
                    "Contacto por identificar"
                  }
                />
              ))}
              {!filtered.length && (
                <div className="cc-home-empty">
                  <Mail size={23} strokeWidth={1.5} aria-hidden />
                  <strong>
                    {channel === "all"
                      ? "Tu bandeja está vacía"
                      : "Todavía no hay conversaciones de " +
                        (channel === "email" ? "correo" : "WhatsApp")}
                  </strong>
                  <p>
                    Los mensajes recibidos aparecerán aquí cuando el canal esté
                    conectado.
                  </p>
                  <Link className="cc-text-action" href="/ajustes">
                    Revisar conexiones
                    <ChevronRight size={14} />
                  </Link>
                </div>
              )}
            </div>
            <div className="cc-inbox-footer">
              {filtered.length > 4 && (
                <button
                  className="cc-text-action"
                  aria-expanded={moreMessages}
                  onClick={() => setMoreMessages(!moreMessages)}
                >
                  {moreMessages ? "Mostrar menos" : "Mostrar más mensajes"}
                  <ChevronRight size={14} />
                </button>
              )}
              <Link className="cc-text-action" href="/whatsapp">
                Ver todas las conversaciones
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </section>

          <section
            className="cc-home-panel"
            aria-labelledby="home-pipeline-title"
          >
            <div className="cc-home-panel-head">
              <div>
                <span className="cc-section-number">02 / VENTAS</span>
                <h2 id="home-pipeline-title">Pipeline comercial</h2>
                <p>{pending.length} oportunidades abiertas</p>
              </div>
              <Link className="cc-text-action" href="/ventas">
                Ver ventas
                <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="cc-pipeline-list">
              {saleStages
                .filter((stage) => stage !== "ganado")
                .map((stage, index) => {
                  const rows = pending.filter((o) => o.stage === stage);
                  return (
                    <details className="cc-pipeline-stage" key={stage}>
                      <summary>
                        <span className="cc-pipeline-index">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="cc-pipeline-label">
                          {saleStageLabel[stage]}
                        </span>
                        <span className="cc-pipeline-count">{rows.length}</span>
                        <ChevronRight size={16} aria-hidden />
                      </summary>
                      <div className="cc-pipeline-opportunities">
                        {!rows.length && (
                          <p className="cc-muted">
                            No hay oportunidades en esta etapa.
                          </p>
                        )}
                        {rows.map((o) => (
                          <button key={o.id} onClick={() => onOpportunity(o)}>
                            <span>
                              <strong>
                                {contact(o.clientId)?.name || "Contacto"}
                              </strong>
                              <span>{o.need}</span>
                              <span className="cc-muted">
                                {o.nextAction || "Definir siguiente paso"}
                                {o.nextActionDue
                                  ? " · " + dateLabel(o.nextActionDue)
                                  : ""}
                              </span>
                            </span>
                            <ArrowUpRight size={15} aria-hidden />
                          </button>
                        ))}
                      </div>
                    </details>
                  );
                })}
            </div>
          </section>
        </div>

        <div className="cc-home-right">
          <aside
            className="cc-home-panel cc-home-priorities"
            aria-labelledby="home-priorities-title"
          >
            <div className="cc-home-panel-head">
              <div>
                <span className="cc-section-number">POR RESOLVER</span>
                <h2 id="home-priorities-title">
                  Prioridades <span>{priorities.length}</span>
                </h2>
                <p>Lo que necesita una acción</p>
              </div>
            </div>
            <div className="cc-priority-list">
              {priorities.slice(0, allPriorities ? undefined : 5).map((p) => (
                <article key={p.id}>
                  <p className="cc-priority-label">{p.label}</p>
                  <h3>{p.name}</h3>
                  <p className="cc-priority-detail">{p.detail}</p>
                  {p.action}
                </article>
              ))}
              {!priorities.length && (
                <div className="cc-home-empty">
                  <strong>Sin pendientes para hoy</strong>
                  <p>Puedes revisar tus conversaciones o avanzar una venta.</p>
                  <Link className="cc-text-action" href="/ventas">
                    Ir a ventas
                    <ChevronRight size={14} />
                  </Link>
                </div>
              )}
            </div>
            {priorities.length > 5 && (
              <button
                className="cc-home-panel-foot"
                aria-expanded={allPriorities}
                onClick={() => setAllPriorities(!allPriorities)}
              >
                {allPriorities
                  ? "Mostrar menos"
                  : `Ver las ${priorities.length} prioridades`}
                <ChevronRight size={14} />
              </button>
            )}
            <div className="cc-priority-links">
              <Link href="/cobros">
                Todos los cobros
                <ArrowUpRight size={14} />
              </Link>
              <Link href="/proyectos">
                Proyectos en marcha
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </aside>
          <HomeSecondary overview={overview} />
        </div>
      </div>
      <HomeActivity overview={overview} error={overviewError} data={d} />
    </div>
  );
}
