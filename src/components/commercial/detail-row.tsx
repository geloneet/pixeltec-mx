import type { ReactNode } from "react";
import {
  ChevronDown,
  Target,
  Users,
  BriefcaseBusiness,
  Receipt,
  FileText,
} from "lucide-react";

/** Native disclosure keeps the whole summary keyboard accessible without nested actions. */
export function DetailRow({
  title,
  subtitle,
  status,
  value,
  next,
  children,
  preview,
  kind,
}: {
  title: string;
  subtitle?: string;
  status: ReactNode;
  value: ReactNode;
  next: ReactNode;
  children: ReactNode;
  preview?: ReactNode;
  kind?: "sale" | "client" | "project" | "billing" | "quote";
}) {
  const Icon = kind
    ? {
        sale: Target,
        client: Users,
        project: BriefcaseBusiness,
        billing: Receipt,
        quote: FileText,
      }[kind]
    : null;
  return (
    <details className="cc-detail-row" data-kind={kind}>
      <summary>
        <span className="cc-row-identity">
          {Icon && (
            <span className="cc-record-icon">
              <Icon size={18} aria-hidden />
            </span>
          )}
          <span>
            <strong>{title}</strong>
            {subtitle && subtitle !== title && <small>{subtitle}</small>}
          </span>
        </span>
        <span className="cc-row-status">{status}</span>
        <span className="cc-row-value">{value}</span>
        <span className="cc-row-next">{next}</span>
        <ChevronDown className="cc-disclosure-arrow" size={16} />
        {preview && <span className="cc-record-preview">{preview}</span>}
      </summary>
      <div className="cc-row-detail">{children}</div>
    </details>
  );
}
export function RowLabels({
  identity,
  status = "Estado",
  value,
  next,
}: {
  identity: string;
  status?: string;
  value: string;
  next: string;
}) {
  return (
    <div className="cc-row-labels" aria-hidden="true">
      <span>{identity}</span>
      <span>{status}</span>
      <span>{value}</span>
      <span>{next}</span>
      <span />
    </div>
  );
}
