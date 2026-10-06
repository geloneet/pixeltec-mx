import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const SAFE_COLOR = /^#[0-9a-f]{3,8}$/i;

/** Logo real del cliente o sus iniciales (nunca un logo inventado). */
export function ClientAvatar({
  name,
  logoUrl,
  color,
  size = 44,
  className,
}: {
  name: string;
  logoUrl: string | null;
  color: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size };
  if (logoUrl && /^https?:\/\//.test(logoUrl)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- logos externos del cliente, dominio arbitrario
      <img src={logoUrl} alt="" style={style} className={cn("flex-shrink-0 rounded-full border border-border bg-card object-cover", className)} />
    );
  }
  const bg = color && SAFE_COLOR.test(color) ? color : undefined;
  return (
    <span
      aria-hidden
      style={{ ...style, backgroundColor: bg }}
      className={cn(
        "flex flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
        !bg && "bg-slate-700 dark:bg-slate-600",
        className
      )}
    >
      {initials(name)}
    </span>
  );
}
