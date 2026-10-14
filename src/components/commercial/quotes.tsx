"use client";
import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import type { CommercialSnapshot } from "@/lib/commercial/snapshot";
import { displayStatus, STATUS_LABEL } from "@/lib/quotes/terms";
import { dateLabel, money, totalsLabel } from "./data";
import { DetailRow, RowLabels } from "./detail-row";
type Quote = CommercialSnapshot["quotes"][number];
export function quoteIsExpiring(q: Quote, now: string) {
  const limit = q.validUntil ? Date.parse(q.validUntil) : NaN;
  return (
    displayStatus(q, new Date(now)) === "enviada" &&
    limit >= Date.parse(now) &&
    limit <= Date.parse(now) + 7 * 86400000
  );
}
export function filterQuotes(
  data: CommercialSnapshot,
  query: string,
  filter: string,
) {
  return data.quotes
    .filter((q) =>
      [q.folio, q.title, data.contacts.find((c) => c.id === q.clientId)?.name]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .filter(
      (q) =>
        filter === "all" ||
        (filter === "expiring"
          ? quoteIsExpiring(q, data.now)
          : displayStatus(q, new Date(data.now)) === filter),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function CommercialQuotes({
  data,
  onPreview,
  onEdit,
  onDecision,
}: {
  data: CommercialSnapshot;
  onPreview: (q: Quote) => void;
  onEdit: (q: Quote) => void;
  onDecision: (q: Quote) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const rows = filterQuotes(data, query, filter);
  const count = (status: string) => filterQuotes(data, "", status).length;
  return (
    <>
      <div className="cc-metrics cc-quotes-metrics">
        {[
          ["all", "Propuestas", data.quotes.length],
          ["enviada", "Esperando respuesta", count("enviada")],
          ["expiring", "Vencen en 7 días", count("expiring")],
          [
            "aceptacion_pendiente",
            "Por confirmar",
            count("aceptacion_pendiente"),
          ],
        ].map(([id, label, value]) => (
          <button
            className="cc-metric"
            key={id}
            onClick={() => setFilter(String(id))}
            aria-pressed={filter === id}
          >
            <span>{label}</span>
            <strong>{value}</strong>
            <small>Ver cotizaciones</small>
          </button>
        ))}
      </div>
      <div className="cc-toolbar">
        <input
          className="cc-input"
          aria-label="Buscar cotizaciones"
          placeholder="Buscar folio, cliente o propuesta…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="cc-small cc-muted">
          {rows.length} de {data.quotes.length} cotizaciones
        </span>
      </div>
      <div
        className="cc-tabs cc-quotes-tabs"
        role="tablist"
        aria-label="Cotizaciones"
      >
        {[
          ["all", "Todas"],
          ["borrador", "Borradores"],
          ["lista", "Listas"],
          ["enviada", "Enviadas"],
          ["aceptacion_pendiente", "Por confirmar"],
          ["aceptada", "Aceptadas"],
          ["vencida", "Vencidas"],
          ["rechazada", "Rechazadas"],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
          >
            {label} <span className="cc-filter-count">{count(id)}</span>
          </button>
        ))}
      </div>
      <div className="cc-record-list">
        <RowLabels
          identity="Propuesta / cliente"
          value="Total inicial"
          next="Vigencia"
        />
        {rows.map((q) => {
          const client = data.contacts.find((c) => c.id === q.clientId);
          const status = displayStatus(q, new Date(data.now));
          return (
            <DetailRow
              key={q.id}
              title={q.title || q.folio}
              subtitle={`${q.folio} · ${client?.name || "Cliente"} · v${q.version}`}
              status={
                <span
                  className={"cc-tag " + (status === "aceptada" ? "green" : "")}
                >
                  {STATUS_LABEL[status]}
                </span>
              }
              value={
                <>
                  {money(q.totals.oneTime.totalCents, q.currency)}
                  {(q.totals.recurring.some((r) => r.totals.totalCents > 0) ||
                    q.totals.annualRenewal) && (
                    <small>+ conceptos recurrentes</small>
                  )}
                </>
              }
              next={
                <>
                  {q.validUntil ? dateLabel(q.validUntil) : "Por definir"}
                  <small>
                    {quoteIsExpiring(q, data.now)
                      ? "Vence en los próximos 7 días"
                      : "Actualizada " + dateLabel(q.updatedAt)}
                  </small>
                </>
              }
            >
              <div className="cc-detail-facts">
                <p>
                  <small>Cliente · folio / versión</small>
                  {client?.name || "Cliente"}
                  <br />
                  {q.folio} · versión {q.version}
                </p>
                <p>
                  <small>Alcance</small>
                  {q.scopeIncluded ||
                    q.solution ||
                    "Completa el alcance en la cotización."}
                </p>
                <p>
                  <small>Total inicial · impuestos según documento</small>
                  {money(q.totals.oneTime.totalCents, q.currency)}
                  {q.totals.recurring.map((r) => (
                    <span className="cc-recurring-amount" key={r.recurrence}>
                      <small>
                        {r.recurrence === "mensual"
                          ? "Mensual"
                          : r.recurrence === "anual"
                            ? "Anual"
                            : "Recurrente"}
                      </small>
                      {money(r.totals.totalCents, q.currency)}
                    </span>
                  ))}
                  {q.totals.annualRenewal && (
                    <span className="cc-recurring-amount">
                      <small>
                        Renovación anual · desde el primer aniversario
                      </small>
                      {money(q.totals.annualRenewal.totalCents, q.currency)}
                    </span>
                  )}
                </p>
                <p>
                  <small>Siguiente seguimiento</small>
                  {dateLabel(q.nextFollowUpAt)}
                </p>
              </div>
              <div className="cc-actions">
                <button className="cc-button" onClick={() => onPreview(q)}>
                  <FileText size={14} /> Ver documento y compartir
                </button>
                {client && (
                  <>
                    <button
                      className="cc-button quiet"
                      onClick={() => onEdit(q)}
                    >
                      Editar / versionar
                    </button>
                    <Link
                      className="cc-button quiet"
                      href={`/clientes/${encodeURIComponent(client.publicId || client.id)}?tab=cotizaciones`}
                    >
                      Ficha del cliente
                    </Link>
                  </>
                )}
                {status === "aceptacion_pendiente" && (
                  <button className="cc-button" onClick={() => onDecision(q)}>
                    Revisar aceptación
                  </button>
                )}
              </div>
            </DetailRow>
          );
        })}
        {!rows.length && (
          <div className="cc-empty">
            <h2>
              {data.quotes.length
                ? "Sin cotizaciones en esta vista"
                : "Prepara tu primera propuesta"}
            </h2>
            <p>
              {data.quotes.length
                ? "Prueba otro estado o una búsqueda distinta."
                : "Elige Nueva cotización para seleccionar un cliente y preparar conceptos, condiciones y vigencia."}
            </p>
            {data.quotes.length > 0 && (
              <button
                className="cc-button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Mostrar todas
              </button>
            )}
          </div>
        )}
      </div>
      <p className="cc-small cc-muted mt-4">
        {totalsLabel(
          rows.map((q) => ({
            currency: q.currency,
            cents: q.totals.oneTime.totalCents,
          })),
        )}{" "}
        en importes iniciales de esta vista. Los recurrentes se consultan en
        cada documento.
      </p>
    </>
  );
}
