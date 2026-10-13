import type { getCommercialThread } from "@/lib/commercial/inbox";

export type CommercialThread = {
  messages: Awaited<ReturnType<typeof getCommercialThread>>;
};

export async function loadCommercialThread(
  url: string,
): Promise<CommercialThread> {
  const response = await fetch(url, { cache: "no-store" });
  const value = await response.json();
  if (!response.ok)
    throw new Error(value.error || "No se pudo cargar la conversación.");
  return value;
}
