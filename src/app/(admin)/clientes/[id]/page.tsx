"use client";

import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCRM } from "@/components/crm/CRMContextCore";
import { useCRMShell } from "@/components/crm/CRMShellProvider";
import { ClientWorkspace } from "@/components/crm/ClientWorkspace";
import { Spinner } from "@/components/ui/spinner";
import { isClientSectionVisible } from "@/lib/modules/client-workspace";
import { browserSessionStorage } from "@/components/hoy/nueva-cotizacion-intent";
import { consumeNuevaOnTabChange, resolveWorkspaceUrl, workspaceTabHref } from "./workspace-url";

export default function ClienteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const crm = useCRM();
  const shell = useCRMShell();

  // La pestaña vive en la URL (?tab=, WO-2026-00519): refresh/atrás/adelante
  // la conservan. Si la URL cambia sin remontar (atrás/adelante dentro de la
  // página), ClientWorkspace sigue a `initialTab`. Deep-links legacy y
  // secciones ocultas: ver workspace-url.ts.
  const { tab: initialTab, sub: initialSub } = resolveWorkspaceUrl(searchParams, isClientSectionVisible);

  if (crm.loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner size="lg" className="text-cyan-400" />
      </div>
    );
  }

  const client = crm.clients.find((c) => c.id === params.id);

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground text-sm mb-4">Cliente no encontrado</p>
        <button
          onClick={() => router.push("/clientes")}
          className="rounded-lg bg-[#0EA5E9] px-4 py-2 text-sm text-white hover:bg-[#0284C7] transition-all duration-150"
        >
          ← Ver clientes
        </button>
      </div>
    );
  }

  return (
    <ClientWorkspace
      client={client}
      onBack={() => router.push("/clientes")}
      navigateToProject={(_cid, pid) => router.push(`/proyectos/${pid}`)}
      setModal={shell.setModal}
      deleteClient={crm.deleteClient}
      initialTab={initialTab}
      initialSub={initialSub}
      // WO-2026-00526: el clic de pestaña escribe `?tab=` con `replace` (no
      // `push`): no ensucia el historial y no deja una entrada con `?nueva=1`
      // a la que volver con atrás. Salir de `?nueva=1` consume la intención
      // del formulario nuevo. Ver docs/evidencias/wo519a/README.md.
      onTabChange={(tab) => {
        consumeNuevaOnTabChange(searchParams, client.id, browserSessionStorage());
        router.replace(workspaceTabHref(pathname, searchParams, tab), { scroll: false });
      }}
    />
  );
}
