"use client";
import { useState, useRef, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import { CommercialInbox } from "./inbox";
import { CommercialSettings } from "./settings";
import { commercialAction } from "./api";
import {
  ClientCommercialActions,
  ProjectCommercialActions,
  BillingCommercialActions,
  QuoteCommercialShare,
} from "./controls";
import {
  Plus,
  ArrowUpRight,
  ChevronRight,
  CalendarDays,
  LayoutGrid,
  List,
  Check,
  Mail,
  MessageCircle,
  CircleDollarSign,
  FolderKanban,
} from "lucide-react";
import type { CommercialSnapshot } from "@/lib/commercial/snapshot";
import type { BillingItem } from "@/types/documents";
import { QuoteForm } from "@/components/crm/workspace-tabs/quote-form";
import { QuoteDocument } from "@/components/crm/workspace-tabs/quote-document";
import { displayStatus } from "@/lib/quotes/terms";
import { acceptQuote } from "@/lib/quotes/actions";
import { CommercialModal } from "./modal";
import {
  saleStages,
  saleStageLabel,
  projectStages,
  projectStageLabel,
  money,
  balanceCents,
  totalsLabel,
  dateLabel,
  todayCivil,
  initials,
} from "./data";

type View =
  | "home"
  | "sales"
  | "clients"
  | "projects"
  | "billing"
  | "settings"
  | "conversations";
type Opportunity = CommercialSnapshot["opportunities"][number];
type Project = CommercialSnapshot["projects"][number];
type Quote = CommercialSnapshot["quotes"][number];
type Contact = CommercialSnapshot["contacts"][number];
type Modal =
  | { kind: "contact" }
  | { kind: "opportunity"; row: Opportunity }
  | { kind: "project"; row: Project }
  | {
      kind: "quote";
      client: Contact;
      row: Quote | null;
      opportunity?: Opportunity;
    }
  | { kind: "quote-preview"; row: Quote }
  | { kind: "payment"; row: BillingItem }
  | { kind: "statement"; client: Contact }
  | { kind: "activation"; row: Quote };
const labels: Record<View, string> = {
  home: "Tu día comercial",
  sales: "Ventas",
  clients: "Clientes",
  projects: "Proyectos",
  billing: "Cobros",
  settings: "Ajustes",
  conversations: "Conversaciones",
};
const descriptions: Record<View, string> = {
  home: "Lo que necesita tu atención, en un solo lugar.",
  sales: "De un primer interés a un proyecto en marcha.",
  clients: "Personas, proyectos y próximos pasos.",
  projects: "Que tus clientes sepan cómo va su proyecto.",
  billing: "Lo que está pendiente, lo que venció y lo que ya recibiste.",
  settings: "Tu espacio, tus conexiones y la forma de atender.",
  conversations: "WhatsApp y correo, con el contexto para responder.",
};
async function loadSnapshot(url: string): Promise<CommercialSnapshot> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error || "No se pudieron cargar los datos.");
  return data;
}

function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="cc-empty">
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
function Progress({
  stage,
  confirmed,
}: {
  stage: Project["stage"];
  confirmed: boolean;
}) {
  const [width, setWidth] = useState(0);
  const index = projectStages.indexOf(stage);
  useEffect(
    () => setWidth(confirmed ? (index + 1) * 25 : 0),
    [index, confirmed],
  );
  return (
    <>
      <div
        className="cc-progress"
        role="progressbar"
        aria-label="Etapa comercial"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={confirmed ? index + 1 : 0}
        aria-valuetext={
          confirmed ? projectStageLabel[stage] : "Etapa por confirmar"
        }
      >
        <span style={{ width: width + "%" }} />
      </div>
      <div className="cc-stage-labels">
        {projectStages.map((s) => (
          <span key={s} className={s === stage && confirmed ? "current" : ""}>
            {projectStageLabel[s]}
          </span>
        ))}
      </div>
    </>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="cc-field">
      {label}
      {children}
    </label>
  );
}
export function CommercialPage({ view }: { view: View }) {
  const {
    data: d,
    error,
    isLoading,
    mutate,
  } = useSWR("/api/commercial", loadSnapshot, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });
  const [modal, setModal] = useState<Modal | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [notice, setNotice] = useState("");
  const [modalError, setModalError] = useState("");
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [board, setBoard] = useState(true);
  const paymentKey = useRef("");
  useEffect(() => {
    setTab("all");
    setSearch("");
  }, [view]);
  const open = (m: Modal) => {
    setModalError("");
    paymentKey.current = crypto.randomUUID();
    setModal(m);
  };
  const close = () => {
    if (!busyRef.current) {
      setModal(null);
      setModalError("");
    }
  };
  const save = async (action: string, input: unknown) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setModalError("");
    try {
      const result = await commercialAction(action, input);
      if (result.needsReview) {
        setModalError(
          "Ya hay contactos con este identificador. Abre su ficha para verificar y vincular la oportunidad: " +
            result.candidates.map((c: { name: string }) => c.name).join(", "),
        );
        return;
      }
      await mutate();
      setModal(null);
      setNotice(result.warning || "Cambio guardado.");
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  if (isLoading && !d)
    return (
      <div className="cc-loading" role="status">
        Cargando tu operación comercial…
      </div>
    );
  if (!d)
    return (
      <div className="cc-page">
        <div className="cc-error" role="alert">
          {error?.message || "No hay datos disponibles."}
        </div>
        <button className="cc-button" onClick={() => mutate()}>
          Volver a intentar
        </button>
      </div>
    );
  const contact = (id: string | null | undefined) =>
    d.contacts.find((c) => c.id === id);
  const href = (c: Contact) =>
    "/clientes/" + encodeURIComponent(c.publicId || c.id);
  const quoteFor = (o: Opportunity) => d.quotes.find((q) => q.id === o.quoteId);
  const billsFor = (id: string) => d.bills.filter((b) => b.clientId === id);
  const balanceFor = (id: string) =>
    totalsLabel(
      billsFor(id)
        .filter((b) => balanceCents(b) > 0)
        .map((b) => ({ currency: b.currency, cents: balanceCents(b) })),
    );
  const quoteAmount = (o: Opportunity) => {
    const q = quoteFor(o);
    return q ? money(q.totals.oneTime.totalCents, q.currency) : "Por cotizar";
  };
  const query = search.trim().toLowerCase();
  const opportunities = d.opportunities.filter((o) =>
    (o.need + " " + contact(o.clientId)?.name).toLowerCase().includes(query),
  );
  const pending = d.opportunities
    .filter((o) => !["ganado", "perdido", "pausado"].includes(o.stage))
    .sort((a, b) =>
      (a.nextActionDue || "9999").localeCompare(b.nextActionDue || "9999"),
    );
  const decisions = d.decisions.filter((a) =>
    d.quotes.some(
      (q) =>
        q.id === a.quoteId &&
        q.version === a.version &&
        (q.status === "aceptacion_pendiente" ||
          (a.decision === "changes" &&
            !["aceptada", "rechazada"].includes(q.status))),
    ),
  );
  const first = pending[0];
  const firstClient = first ? contact(first.clientId) : undefined;
  const nextDue = (o: Opportunity) =>
    o.nextActionDue
      ? "Para el " + dateLabel(o.nextActionDue)
      : "Agenda el siguiente paso";
  const opportunityCard = (o: Opportunity) => (
    <article className="cc-card" key={o.id}>
      <div className="cc-row-head">
        <span className="cc-small cc-muted">{contact(o.clientId)?.name}</span>
        <span className="cc-tag">
          {o.source === "email"
            ? "Correo"
            : o.source === "whatsapp"
              ? "WhatsApp"
              : o.source === "form"
                ? "Formulario"
                : "Manual"}
        </span>
      </div>
      <h3 className="mt-3 font-semibold">{o.need}</h3>
      <p className="cc-money">{quoteAmount(o)}</p>
      <div className="cc-actions">
        <span className="cc-tag">{saleStageLabel[o.stage]}</span>
        <span className="cc-small cc-muted">Responsable: {d.user.name}</span>
      </div>
      <p className="cc-next">
        {o.nextAction || "Define el siguiente paso"}
        <br />
        <span className="cc-muted">{nextDue(o)}</span>
      </p>
      <div className="cc-actions mt-4">
        <button
          className="cc-button"
          onClick={() => open({ kind: "opportunity", row: o })}
        >
          Ver venta <ChevronRight size={14} />
        </button>
        {contact(o.clientId) && (
          <button
            className="cc-button quiet"
            onClick={() =>
              open({
                kind: "quote",
                client: contact(o.clientId)!,
                row: quoteFor(o) || null,
                opportunity: o,
              })
            }
          >
            {quoteFor(o) ? "Editar cotización" : "Crear cotización"}
          </button>
        )}
      </div>
    </article>
  );
  return (
    <div className="cc-page cc-enter" key={view}>
      <header className="cc-head">
        <div>
          <h1>{labels[view]}</h1>
          <p>
            {view === "home"
              ? new Intl.DateTimeFormat("es-MX", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "America/Mexico_City",
                }).format(new Date(d.now))
              : descriptions[view]}
          </p>
        </div>
        {["home", "sales", "clients"].includes(view) && (
          <button
            className="cc-button"
            onClick={() => open({ kind: "contact" })}
          >
            <Plus size={16} />
            Nuevo contacto
          </button>
        )}
      </header>
      {error && (
        <div className="cc-error" role="alert">
          {error.message} <button onClick={() => mutate()}>Actualizar</button>
        </div>
      )}
      {notice && (
        <p role="status" className="cc-small cc-muted mb-4">
          {notice}
        </p>
      )}
      {view === "home" && (
        <>
          {first && firstClient ? (
            <section
              className="cc-card cc-hero"
              aria-labelledby="priority-title"
            >
              <div className="cc-hero-main">
                <span className="cc-kicker">Atiende primero</span>
                <div className="cc-hero-client">
                  <span className="cc-avatar">
                    {initials(firstClient.name)}
                  </span>
                  <div>
                    <strong>{firstClient.name}</strong>
                    <p>
                      {first.source === "email"
                        ? "Correo"
                        : first.source === "whatsapp"
                          ? "WhatsApp"
                          : "Contacto comercial"}{" "}
                      · {dateLabel(first.updatedAt)}
                    </p>
                  </div>
                  <span className="cc-tag amber">
                    {first.nextActionDue && first.nextActionDue <= todayCivil()
                      ? "Seguimiento pendiente"
                      : first.stage === "nuevo"
                        ? "Nuevo interés"
                        : saleStageLabel[first.stage]}
                  </span>
                </div>
                <h2 id="priority-title">{first.need}</h2>
                <p className="cc-muted">
                  {first.nextAction ||
                    "Revisa el contexto y acuerda el siguiente paso."}
                </p>
                <div className="cc-actions">
                  <button
                    className="cc-button primary"
                    onClick={() => open({ kind: "opportunity", row: first })}
                  >
                    Revisar oportunidad <ArrowUpRight size={15} />
                  </button>
                  <Link
                    className="cc-button"
                    href={"/whatsapp?client=" + firstClient.id}
                  >
                    Abrir conversación
                  </Link>
                  <button
                    className="cc-button quiet"
                    onClick={() => open({ kind: "opportunity", row: first })}
                  >
                    <CalendarDays size={15} />
                    Agendar
                  </button>
                </div>
              </div>
              <div className="cc-hero-side">
                <span className="cc-kicker">El siguiente paso</span>
                <h3 className="mt-4 font-semibold">
                  {saleStageLabel[first.stage]}
                </h3>
                <p>{nextDue(first)}</p>
                <span className="cc-tag">{quoteAmount(first)}</span>
                <details>
                  <summary>Por qué aparece primero</summary>
                  <p>
                    Prioridad calculada por la fecha del siguiente paso entre
                    las oportunidades abiertas. Se conserva la necesidad y el
                    historial del contacto.
                  </p>
                </details>
              </div>
            </section>
          ) : (
            <Empty
              title="Tu día está al corriente"
              text="Agrega un contacto o revisa las oportunidades para definir el próximo paso."
            />
          )}
          <div className="cc-tabs" role="tablist" aria-label="Prioridades">
            {[
              [
                "all",
                "Nuevos interesados",
                pending.filter((o) => o.stage === "nuevo").length,
              ],
              [
                "decision",
                "Necesitan tu decisión",
                decisions.length +
                  d.conversations.filter((c) => c.state === "decision").length,
              ],
              [
                "follow",
                "Seguimientos de hoy",
                pending.filter(
                  (o) => o.nextActionDue && o.nextActionDue <= todayCivil(),
                ).length,
              ],
            ].map(([id, label, count]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(String(id))}
              >
                {label}
                <span>{count}</span>
              </button>
            ))}
          </div>
          {tab === "decision" ? (
            <div className="cc-line-list">
              {decisions.length === 0 &&
                !d.conversations.some((c) => c.state === "decision") && (
                  <div className="p-5 cc-muted">
                    No hay decisiones pendientes.
                  </div>
                )}
              {decisions.map((a) => {
                const q = d.quotes.find((q) => q.id === a.quoteId)!;
                return (
                  <div className="cc-line-row" key={a.id}>
                    <span className="cc-avatar">
                      {initials(contact(q.clientId)?.name || "")}
                    </span>
                    <div className="cc-line-content">
                      <strong>
                        {contact(q.clientId)?.name} · {q.title}
                      </strong>
                      <p>
                        {a.actorName}{" "}
                        {a.decision === "accept"
                          ? "aceptó"
                          : "solicitó cambios en"}{" "}
                        la versión {a.version} el {dateLabel(a.createdAt)}
                      </p>
                    </div>
                    <button
                      className="cc-button primary"
                      onClick={() =>
                        a.decision === "accept"
                          ? open({ kind: "activation", row: q })
                          : open({
                              kind: "quote",
                              row: q,
                              client: contact(q.clientId)!,
                            })
                      }
                    >
                      {a.decision === "accept"
                        ? "Confirmar venta"
                        : "Revisar cambios"}
                    </button>
                  </div>
                );
              })}
              {d.conversations
                .filter((c) => c.state === "decision")
                .map((c) => (
                  <div className="cc-line-row" key={c.id}>
                    <span className="cc-avatar">
                      <MessageCircle size={18} />
                    </span>
                    <div className="cc-line-content">
                      <strong>
                        {contact(c.clientId || "")?.name ||
                          c.subject ||
                          "Contacto por revisar"}
                      </strong>
                      <p>
                        {c.matchReview
                          ? "Confirma a quién pertenece este contacto."
                          : "La conversación necesita tu decisión."}
                      </p>
                    </div>
                    <Link
                      className="cc-button primary"
                      href={"/whatsapp?conversation=" + c.id}
                    >
                      Abrir conversación
                    </Link>
                  </div>
                ))}
            </div>
          ) : (
            <div className="cc-line-list">
              {pending
                .filter((o) =>
                  tab === "follow"
                    ? o.nextActionDue && o.nextActionDue <= todayCivil()
                    : o.stage === "nuevo",
                )
                .slice(0, 8)
                .map((o) => (
                  <div className="cc-line-row" key={o.id}>
                    <span className="cc-avatar">
                      {initials(contact(o.clientId)?.name || "")}
                    </span>
                    <div className="cc-line-content">
                      <strong>{contact(o.clientId)?.name}</strong>
                      <p>
                        {o.need} · {nextDue(o)}
                      </p>
                    </div>
                    <span className="cc-tag">{saleStageLabel[o.stage]}</span>
                    <button
                      className="cc-button"
                      onClick={() => open({ kind: "opportunity", row: o })}
                    >
                      Revisar <ChevronRight size={14} />
                    </button>
                  </div>
                ))}
            </div>
          )}
          <Link href="/proyectos" className="cc-secondary-row">
            <span>
              <FolderKanban size={15} className="inline mr-2" />
              {d.projects.filter((p) => p.stage !== "entregado").length}{" "}
              proyectos en marcha
            </span>
            <span>
              Ver proyectos <ChevronRight size={14} className="inline" />
            </span>
          </Link>
          <Link href="/cobros" className="cc-secondary-row">
            <span>
              <CircleDollarSign size={15} className="inline mr-2" />
              {d.bills.filter((b) => balanceCents(b) > 0).length} cobros
              pendientes
            </span>
            <span>
              Revisar cobros <ChevronRight size={14} className="inline" />
            </span>
          </Link>
        </>
      )}
      {view === "sales" && (
        <>
          <div className="cc-metrics">
            {[
              [
                "Potencial abierto",
                totalsLabel(
                  pending.flatMap((o) => {
                    const q = quoteFor(o);
                    return q
                      ? [
                          {
                            currency: q.currency,
                            cents: q.totals.oneTime.totalCents,
                          },
                        ]
                      : [];
                  }),
                ),
                pending.length + " oportunidades",
              ],
              [
                "Por cerrar",
                String(pending.filter((o) => o.stage === "cierre").length),
                "Revisa el próximo paso",
              ],
              [
                "Ganadas",
                String(
                  d.opportunities.filter((o) => o.stage === "ganado").length,
                ),
                "Cotizaciones aceptadas",
              ],
              [
                "Cobrado",
                totalsLabel(
                  d.bills.map((b) => ({
                    currency: b.currency,
                    cents: b.paymentHistory.reduce(
                      (s, p) => s + Math.round(p.amount * 100),
                      0,
                    ),
                  })),
                ),
                "Pagos registrados",
              ],
            ].map(([label, value, note]) => (
              <div className="cc-metric" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{note}</small>
              </div>
            ))}
          </div>
          <div className="cc-toolbar">
            <input
              aria-label="Buscar ventas"
              className="cc-input"
              placeholder="Buscar una venta…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="cc-actions">
              <span className="cc-small cc-muted">
                Responsable: {d.user.name}
              </span>
              <button
                className="cc-button"
                aria-pressed={board}
                onClick={() => setBoard(!board)}
              >
                {board ? <List size={15} /> : <LayoutGrid size={15} />}{" "}
                {board ? "Ver lista" : "Ver tablero"}
              </button>
            </div>
          </div>
          <div className="cc-stage-strip">
            {saleStages.map((s) => (
              <button
                key={s}
                aria-pressed={tab === s}
                onClick={() => setTab(tab === s ? "all" : s)}
              >
                <b>{d.opportunities.filter((o) => o.stage === s).length}</b>
                {saleStageLabel[s]}
              </button>
            ))}
          </div>
          {board ? (
            <div className="cc-board">
              {saleStages.map((s) => (
                <section className="cc-board-col" key={s}>
                  <h2>{saleStageLabel[s]}</h2>
                  {opportunities
                    .filter((o) => o.stage === s)
                    .map(opportunityCard)}
                </section>
              ))}
            </div>
          ) : opportunities.length ? (
            <div className="cc-grid">
              {opportunities
                .filter((o) =>
                  tab === "all"
                    ? !["pausado", "perdido"].includes(o.stage)
                    : o.stage === tab,
                )
                .map(opportunityCard)}
            </div>
          ) : (
            <Empty
              title="Tu primera oportunidad empieza aquí"
              text="Crea un contacto con su necesidad. El importe aparecerá al vincular una cotización real."
            />
          )}
          <details className="mt-6 cc-small cc-muted">
            <summary>
              En pausa y perdidas (
              {
                opportunities.filter((o) =>
                  ["pausado", "perdido"].includes(o.stage),
                ).length
              }
              )
            </summary>
            <div className="cc-grid mt-4">
              {opportunities
                .filter((o) => ["pausado", "perdido"].includes(o.stage))
                .map(opportunityCard)}
            </div>
          </details>
        </>
      )}
      {view === "clients" && (
        <>
          <div className="cc-toolbar">
            <input
              aria-label="Buscar clientes"
              className="cc-input"
              placeholder="Buscar un cliente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="cc-small cc-muted">
              {d.contacts.length} contactos en tu cartera
            </span>
          </div>
          <div className="cc-tabs" role="tablist" aria-label="Clientes">
            {[
              ["all", "Todos"],
              ["balance", "Con saldo"],
              ["sales", "En venta"],
              ["clear", "Al corriente"],
            ].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="cc-grid">
            {d.contacts
              .filter((c) => c.name.toLowerCase().includes(query))
              .filter((c) =>
                tab === "balance"
                  ? billsFor(c.id).some((b) => balanceCents(b) > 0)
                  : tab === "sales"
                    ? pending.some((o) => o.clientId === c.id)
                    : tab === "clear"
                      ? billsFor(c.id).length > 0 &&
                        billsFor(c.id).every((b) => balanceCents(b) === 0)
                      : true,
              )
              .map((c) => (
                <article className="cc-card" key={c.id}>
                  <div className="cc-contact-top">
                    <span className="cc-avatar">{initials(c.name)}</span>
                    <div>
                      <h2>{c.name}</h2>
                      <p>{c.contactName || "Contacto comercial"}</p>
                    </div>
                  </div>
                  <span className="cc-tag">
                    {c.status === "prospecto"
                      ? "En venta"
                      : c.status === "activo"
                        ? "Cliente activo"
                        : c.status === "pausado"
                          ? "En pausa"
                          : "Cerrado"}
                  </span>
                  <p className="cc-contact-meta">
                    {d.projects
                      .filter((p) => p.clientId === c.id)
                      .map((p) => p.name)
                      .join(" · ") || "Sin proyectos registrados"}
                  </p>
                  <div className="cc-balance">
                    <span>
                      {billsFor(c.id).some((b) => balanceCents(b) > 0)
                        ? "Saldo pendiente"
                        : "Cuenta"}
                    </span>
                    <strong>
                      {billsFor(c.id).length === 0
                        ? "Sin cobros"
                        : billsFor(c.id).some((b) => balanceCents(b) > 0)
                          ? balanceFor(c.id)
                          : "Al corriente"}
                    </strong>
                  </div>
                  <p className="cc-small cc-muted">
                    {pending.find((o) => o.clientId === c.id)?.nextAction ||
                      "Sin siguiente paso registrado"}
                  </p>
                  <div className="cc-card-footer cc-actions">
                    <Link href={href(c)} className="cc-button">
                      Ver cliente <ChevronRight size={14} />
                    </Link>
                    <button
                      className="cc-button quiet"
                      onClick={() => open({ kind: "statement", client: c })}
                    >
                      Estado de cuenta
                    </button>
                    <ClientCommercialActions
                      client={c}
                      data={d}
                      refresh={mutate}
                    />
                  </div>
                </article>
              ))}
          </div>
          {!d.contacts.length && (
            <Empty
              title="Tu cartera, en un solo lugar"
              text="Agrega el primer contacto para conservar su necesidad, conversaciones y próximos pasos."
            />
          )}
        </>
      )}
      {view === "projects" && (
        <>
          <div className="cc-toolbar">
            <input
              aria-label="Buscar proyectos"
              className="cc-input"
              placeholder="Buscar proyecto o cliente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="cc-small cc-muted">
              {d.projects.length} proyectos
            </span>
          </div>
          <div className="cc-grid two">
            {d.projects
              .filter((p) =>
                (p.name + " " + contact(p.clientId)?.name)
                  .toLowerCase()
                  .includes(query),
              )
              .map((p) => (
                <article className="cc-card" key={p.id}>
                  <div className="cc-row-head">
                    <div>
                      <p className="cc-small cc-muted mb-2">
                        {contact(p.clientId)?.name}
                      </p>
                      <h2>{p.name}</h2>
                    </div>
                    <span
                      className={
                        "cc-tag " + (p.stage === "entregado" ? "green" : "")
                      }
                    >
                      {p.revision > 0
                        ? projectStageLabel[p.stage]
                        : "Etapa por confirmar"}
                    </span>
                  </div>
                  <Progress stage={p.stage} confirmed={p.revision > 0} />
                  <p className="cc-small cc-muted mt-5">
                    {p.note || "Todavía no hay una nota para el cliente."}
                  </p>
                  <p className="cc-next">
                    <strong>Siguiente paso</strong>
                    <br />
                    {p.nextStep || "Por definir"} · {dateLabel(p.due)}
                  </p>
                  <div className="cc-balance">
                    <span>Saldo de la cuenta</span>
                    <strong>{balanceFor(p.clientId)}</strong>
                  </div>
                  <div className="cc-card-footer cc-actions">
                    <button
                      className="cc-button"
                      onClick={() => open({ kind: "project", row: p })}
                    >
                      Actualizar avance
                    </button>
                    <Link
                      className="cc-button quiet"
                      href={
                        "/proyectos/" + encodeURIComponent(p.publicId || p.id)
                      }
                    >
                      Trabajo interno <ArrowUpRight size={13} />
                    </Link>
                    <ProjectCommercialActions
                      project={p}
                      data={d}
                      refresh={mutate}
                    />
                  </div>
                </article>
              ))}
          </div>
          {!d.projects.length && (
            <Empty
              title="Tus proyectos aparecerán aquí"
              text="Confirma una venta y su anticipo según las condiciones acordadas. El sistema conservará un único proyecto por venta."
            />
          )}
        </>
      )}
      {view === "billing" && (
        <>
          <div className="cc-metrics billing">
            {[
              ["Vencido", d.bills.filter((b) => b.status === "vencido")],
              [
                "Pendiente",
                d.bills.filter(
                  (b) => balanceCents(b) > 0 && b.status !== "vencido",
                ),
              ],
              ["Recibido", d.bills.filter((b) => b.paymentHistory.length > 0)],
            ].map(([label, rows]) => (
              <div className="cc-metric" key={String(label)}>
                <span>{String(label)}</span>
                <strong>
                  {totalsLabel(
                    (rows as BillingItem[]).map((b) => ({
                      currency: b.currency,
                      cents:
                        label === "Recibido"
                          ? b.paymentHistory.reduce(
                              (s, p) => s + Math.round(p.amount * 100),
                              0,
                            )
                          : balanceCents(b),
                    })),
                  )}
                </strong>
                <small>
                  {(rows as BillingItem[]).length}{" "}
                  {label === "Recibido" ? "cuentas con pagos" : "cobros"}
                </small>
              </div>
            ))}
          </div>
          <div className="cc-tabs" role="tablist" aria-label="Cobros">
            {[
              ["all", "Pendientes"],
              ["overdue", "Vencidos"],
              ["paid", "Pagados"],
            ].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="cc-grid two">
            {d.bills
              .filter((b) =>
                tab === "paid"
                  ? b.status === "pagado"
                  : tab === "overdue"
                    ? b.status === "vencido"
                    : balanceCents(b) > 0,
              )
              .map((b) => (
                <article className="cc-card" key={b.id}>
                  <div className="cc-row-head">
                    <div>
                      <p className="cc-small cc-muted mb-2">{b.clientName}</p>
                      <h2>{b.concept}</h2>
                    </div>
                    <span
                      className={
                        "cc-tag " +
                        (b.status === "vencido"
                          ? "red"
                          : b.status === "pagado"
                            ? "green"
                            : "amber")
                      }
                    >
                      {b.status === "vencido"
                        ? "Vencido"
                        : b.status === "parcial"
                          ? "Pago parcial"
                          : b.status === "pagado"
                            ? "Pagado"
                            : "Pendiente"}
                    </span>
                  </div>
                  <div className="cc-money">
                    {money(balanceCents(b), b.currency)}{" "}
                    <span className="cc-small cc-muted">por recibir</span>
                  </div>
                  <p className="cc-small cc-muted">
                    Total del período:{" "}
                    {money(Math.round(b.amount * 100), b.currency)} · Vence{" "}
                    {dateLabel(b.dueDate)}
                  </p>
                  <p className="cc-next">
                    {b.paymentHistory.length} pagos en el historial ·{" "}
                    {d.reminders.find((r) => r.billingItemId === b.id)
                      ?.status || "Sin recordatorio programado"}
                  </p>
                  <div className="cc-card-footer cc-actions">
                    {balanceCents(b) > 0 && (
                      <button
                        className="cc-button"
                        onClick={() => open({ kind: "payment", row: b })}
                      >
                        Registrar pago
                      </button>
                    )}
                    {contact(b.clientId) && (
                      <button
                        className="cc-button quiet"
                        onClick={() =>
                          open({
                            kind: "statement",
                            client: contact(b.clientId)!,
                          })
                        }
                      >
                        Estado de cuenta
                      </button>
                    )}
                    <BillingCommercialActions
                      bill={b}
                      data={d}
                      refresh={mutate}
                    />
                  </div>
                </article>
              ))}
          </div>
          {!d.bills.length && (
            <Empty
              title="No hay cobros registrados"
              text="Los saldos proceden de los cobros del sistema. Aquí aparecerán anticipos, pagos parciales y vencimientos."
            />
          )}
        </>
      )}
      {view === "settings" && <CommercialSettings data={d} refresh={mutate} />}
      {view === "conversations" && (
        <CommercialInbox data={d} refresh={mutate} />
      )}
      {modal && (
        <CommercialModal
          title={
            modal.kind === "contact"
              ? "Nuevo contacto"
              : modal.kind === "opportunity"
                ? "Dar seguimiento a la venta"
                : modal.kind === "project"
                  ? "Actualizar avance"
                  : modal.kind === "quote"
                    ? modal.row
                      ? "Editar cotización"
                      : "Nueva cotización"
                    : modal.kind === "quote-preview"
                      ? "Así la ve el cliente"
                      : modal.kind === "payment"
                        ? "Registrar pago"
                        : modal.kind === "statement"
                          ? "Estado de cuenta"
                          : "Confirmar venta"
          }
          description={
            modal.kind === "project"
              ? "La nota se publicará en el portal del cliente. Los cobros y el avance técnico conservan sus datos."
              : modal.kind === "payment"
                ? "Confirma un pago realmente recibido. El envío de un recordatorio no registra un pago."
                : undefined
          }
          onClose={close}
          busy={busy}
          wide={modal.kind === "quote" || modal.kind === "quote-preview"}
        >
          {modalError && (
            <div className="cc-error" role="alert">
              {modalError}
            </div>
          )}
          {modal.kind === "contact" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void save("contact", {
                  name: f.get("name"),
                  contactName: f.get("contactName") || undefined,
                  email: f.get("email") || undefined,
                  phone: f.get("phone") || undefined,
                  need: f.get("need"),
                  notes: "",
                  source: "manual",
                });
              }}
            >
              <Field label="Nombre o empresa">
                <input name="name" required maxLength={200} />
              </Field>
              <Field label="Persona de contacto">
                <input name="contactName" maxLength={200} />
              </Field>
              <div className="cc-form-grid">
                <Field label="Correo">
                  <input name="email" type="email" maxLength={254} />
                </Field>
                <Field label="WhatsApp (con código de país)">
                  <input
                    name="phone"
                    type="tel"
                    placeholder="+52…"
                    pattern="\+?[1-9][0-9]{7,14}"
                  />
                </Field>
              </div>
              <Field label="¿Qué necesita?">
                <textarea name="need" required maxLength={2000} />
              </Field>
              <div className="cc-form-end">
                <button type="button" className="cc-button" onClick={close}>
                  Cancelar
                </button>
                <button disabled={busy} className="cc-button primary">
                  {busy ? "Guardando…" : "Crear contacto"}
                </button>
              </div>
            </form>
          )}
          {modal.kind === "opportunity" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void save("opportunity", {
                  id: modal.row.id,
                  revision: modal.row.revision,
                  need: f.get("need"),
                  stage: f.get("stage"),
                  nextAction: f.get("nextAction"),
                  nextActionDue: f.get("due") || null,
                  reason: f.get("reason") || "",
                  assignedTo: modal.row.assignedTo || d.user.id,
                  quoteId: f.get("quoteId") || null,
                });
              }}
            >
              <p className="cc-muted cc-small mb-4">
                {contact(modal.row.clientId)?.name} · {quoteAmount(modal.row)}
              </p>
              <Field label="Necesidad">
                <textarea
                  name="need"
                  defaultValue={modal.row.need}
                  required
                  maxLength={2000}
                />
              </Field>
              <div className="cc-form-grid">
                <Field label="Etapa">
                  <select name="stage" defaultValue={modal.row.stage}>
                    {Object.entries(saleStageLabel).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Responsable">
                  <input value={d.user.name} readOnly />
                </Field>
              </div>
              <Field label="Siguiente paso">
                <input
                  name="nextAction"
                  defaultValue={modal.row.nextAction}
                  maxLength={500}
                />
              </Field>
              <Field label="Fecha de seguimiento">
                <input
                  name="due"
                  type="date"
                  defaultValue={modal.row.nextActionDue || ""}
                />
              </Field>
              <Field label="Cotización vinculada">
                <select name="quoteId" defaultValue={modal.row.quoteId || ""}>
                  <option value="">Sin cotización</option>
                  {d.quotes
                    .filter((q) => q.clientId === modal.row.clientId)
                    .map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.folio} · {q.title}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Motivo (si pausas o pierdes esta venta)">
                <input
                  name="reason"
                  defaultValue={modal.row.reason}
                  maxLength={2000}
                />
              </Field>
              {quoteFor(modal.row) && (
                <div className="cc-actions">
                  <button
                    type="button"
                    className="cc-button"
                    onClick={() =>
                      open({ kind: "quote-preview", row: quoteFor(modal.row)! })
                    }
                  >
                    Ver cotización como cliente
                  </button>
                  <Link
                    className="cc-button quiet"
                    href={href(contact(modal.row.clientId)!)}
                  >
                    Abrir ficha del cliente
                  </Link>
                </div>
              )}
              <div className="cc-form-end">
                <button type="button" className="cc-button" onClick={close}>
                  Cancelar
                </button>
                <button disabled={busy} className="cc-button primary">
                  {busy ? "Guardando…" : "Guardar seguimiento"}
                </button>
              </div>
            </form>
          )}
          {modal.kind === "project" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void save("project", {
                  id: modal.row.id,
                  commercialRevision: modal.row.revision,
                  commercialStage: f.get("stage"),
                  clientNote: f.get("note"),
                  nextStep: f.get("next"),
                  nextStepDue: f.get("due") || null,
                });
              }}
            >
              <p className="cc-small cc-muted mb-4">
                {modal.row.name} · {contact(modal.row.clientId)?.name}
              </p>
              <Field label="Etapa del proyecto">
                <select name="stage" defaultValue={modal.row.stage}>
                  {projectStages.map((s) => (
                    <option key={s} value={s}>
                      {projectStageLabel[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nota para el cliente">
                <textarea
                  name="note"
                  defaultValue={modal.row.note}
                  maxLength={4000}
                />
              </Field>
              <Field label="Próximo paso">
                <input
                  name="next"
                  defaultValue={modal.row.nextStep}
                  maxLength={500}
                />
              </Field>
              <Field label="Fecha">
                <input
                  name="due"
                  type="date"
                  defaultValue={modal.row.due || ""}
                />
              </Field>
              <div className="cc-form-end">
                <button type="button" className="cc-button" onClick={close}>
                  Cancelar
                </button>
                <button disabled={busy} className="cc-button primary">
                  {busy ? "Guardando…" : "Confirmar actualización"}
                </button>
              </div>
            </form>
          )}
          {modal.kind === "quote" && (
            <QuoteForm
              clientId={modal.client.publicId || modal.client.id}
              clientName={modal.client.name}
              quote={
                modal.row
                  ? {
                      ...modal.row,
                      status: displayStatus(modal.row, new Date()),
                    }
                  : null
              }
              onCancel={close}
              onSaved={async (id) => {
                if (modal.opportunity) {
                  await save("opportunity", {
                    id: modal.opportunity.id,
                    revision: modal.opportunity.revision,
                    need: modal.opportunity.need,
                    stage: "cotizacion",
                    nextAction: modal.opportunity.nextAction,
                    nextActionDue: modal.opportunity.nextActionDue,
                    reason: modal.opportunity.reason,
                    assignedTo: modal.opportunity.assignedTo,
                    quoteId: id,
                  });
                } else {
                  await mutate();
                  setModal(null);
                }
              }}
            />
          )}
          {modal.kind === "quote-preview" && (
            <>
              <QuoteDocument
                quote={modal.row}
                clientName={contact(modal.row.clientId)?.name || ""}
              />
              <p className="cc-small cc-muted mt-5">
                Versión {modal.row.version}. El enlace protegido se comparte
                desde la ficha del cliente y conserva esta cotización.
              </p>
              <Link
                href={"/c/" + modal.row.publicToken}
                target="_blank"
                className="cc-button mt-4"
              >
                Abrir enlace del cliente <ArrowUpRight size={14} />
              </Link>
              <QuoteCommercialShare
                quote={modal.row}
                data={d}
                refresh={mutate}
              />
            </>
          )}
          {modal.kind === "payment" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void save("payment", {
                  billingItemId: modal.row.id,
                  amount: String(f.get("amount")),
                  method: f.get("method"),
                  paidAt: f.get("paidAt"),
                  reference: f.get("reference") || "",
                  note: f.get("note") || "",
                  expectedPeriodDue: modal.row.dueDate,
                  idempotencyKey: paymentKey.current,
                });
              }}
            >
              <p className="cc-small cc-muted mb-4">
                {modal.row.clientName} · {modal.row.concept}
                <br />
                Saldo del período:{" "}
                {money(balanceCents(modal.row), modal.row.currency)} · Vence{" "}
                {dateLabel(modal.row.dueDate)}
              </p>
              <Field label="Importe recibido">
                <input
                  name="amount"
                  inputMode="decimal"
                  pattern="[0-9]+(\.[0-9]{1,2})?"
                  required
                  defaultValue={(balanceCents(modal.row) / 100).toFixed(2)}
                />
              </Field>
              <div className="cc-form-grid">
                <Field label="Método">
                  <select name="method">
                    <option value="transferencia">Transferencia</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </Field>
                <Field label="Fecha del pago">
                  <input
                    name="paidAt"
                    type="date"
                    required
                    defaultValue={todayCivil()}
                  />
                </Field>
              </div>
              <Field label="Referencia">
                <input name="reference" maxLength={200} />
              </Field>
              <Field label="Nota">
                <textarea name="note" maxLength={1500} />
              </Field>
              <label className="cc-small flex gap-2">
                <input type="checkbox" required />
                Verifiqué que este importe fue recibido.
              </label>
              <div className="cc-form-end">
                <button type="button" className="cc-button" onClick={close}>
                  Cancelar
                </button>
                <button disabled={busy} className="cc-button primary">
                  {busy ? "Registrando…" : "Confirmar pago recibido"}
                </button>
              </div>
            </form>
          )}
          {modal.kind === "statement" && (
            <>
              <h3 className="font-semibold mb-4">{modal.client.name}</h3>
              {billsFor(modal.client.id).length ? (
                billsFor(modal.client.id).map((b) => (
                  <div key={b.id} className="cc-card mb-3">
                    <div className="cc-row-head">
                      <strong>{b.concept}</strong>
                      <span>{money(balanceCents(b), b.currency)}</span>
                    </div>
                    <p className="cc-small cc-muted mt-2">
                      Vence {dateLabel(b.dueDate)} · {b.status}
                    </p>
                    {b.paymentHistory.map((p) => (
                      <p key={p.id} className="cc-small mt-2">
                        {dateLabel(p.paidAt)} ·{" "}
                        {money(Math.round(p.amount * 100), b.currency)} ·{" "}
                        {p.method}
                      </p>
                    ))}
                  </div>
                ))
              ) : (
                <p className="cc-muted">
                  Esta cuenta todavía no tiene cobros registrados.
                </p>
              )}
              <p className="mt-5 font-semibold">
                Saldo: {balanceFor(modal.client.id)}
              </p>
            </>
          )}
          {modal.kind === "activation" && (
            <>
              <p>
                {contact(modal.row.clientId)?.name} aceptó{" "}
                <strong>{modal.row.title}</strong>, versión {modal.row.version}.
              </p>
              <p className="cc-muted cc-small mt-4">
                Confirma la venta para generar sus cobros conforme a la
                cotización. El proyecto se aprovisiona una sola vez cuando el
                anticipo deja la venta lista para arrancar.
              </p>
              <div className="cc-form-end">
                <button className="cc-button" onClick={close}>
                  Cancelar
                </button>
                <button
                  disabled={busy}
                  className="cc-button primary"
                  onClick={async () => {
                    if (busyRef.current) return;
                    busyRef.current = true;
                    setBusy(true);
                    try {
                      const r = await acceptQuote({
                        id: modal.row.id,
                        acceptedVia: "otro",
                        acceptedAt: todayCivil(),
                        note:
                          "Aceptación desde enlace del cliente, versión " +
                          modal.row.version,
                      });
                      if (!r.ok) throw new Error(r.error);
                      await mutate();
                      setModal(null);
                      setNotice(
                        "Venta confirmada. Revisa el anticipo en Cobros.",
                      );
                    } catch (e) {
                      setModalError(
                        e instanceof Error
                          ? e.message
                          : "No se pudo confirmar.",
                      );
                    } finally {
                      busyRef.current = false;
                      setBusy(false);
                    }
                  }}
                >
                  Confirmar venta y cobros
                </button>
              </div>
            </>
          )}
        </CommercialModal>
      )}
    </div>
  );
}
