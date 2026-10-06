/** Encabezado de Inicio: saludo con el nombre real de la sesión y fecha en CDMX. */
export function HoyHeader({ name, dateLabel }: { name: string | null; dateLabel: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[28px]">
          {name ? `¡Hola, ${name}!` : "¡Hola!"}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Aquí está el panorama de tu negocio hoy.</p>
      </div>
      <p className="text-sm text-muted-foreground">{dateLabel}</p>
    </div>
  );
}
