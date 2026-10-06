import { cn } from "@/lib/utils";
import { CARD } from "./tones";

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted motion-reduce:animate-none", className)} />;
}

/** Esqueleto de /hoy mientras se arma la instantánea (misma retícula que la página). */
export function HoySkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5" aria-busy="true" aria-label="Cargando Inicio">
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-2">
          <Bone className="h-8 w-48" />
          <Bone className="h-4 w-72" />
        </div>
        <Bone className="h-4 w-44" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={cn(CARD, "flex gap-3 p-4")}>
            <Bone className="h-10 w-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Bone className="h-3 w-24" />
              <Bone className="h-7 w-16" />
              <Bone className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(300px,1fr)]">
        <div className={cn(CARD, "flex flex-col gap-4 p-5")}>
          <Bone className="h-5 w-40" />
          {Array.from({ length: 5 }, (_, i) => (
            <Bone key={i} className="h-14 w-full" />
          ))}
        </div>
        <div className="flex flex-col gap-5">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className={cn(CARD, "flex flex-col gap-3 p-5")}>
              <Bone className="h-5 w-32" />
              <Bone className="h-4 w-full" />
              <Bone className="h-4 w-5/6" />
              <Bone className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
