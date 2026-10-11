export async function commercialAction(action: string, data: unknown) {
  const res = await fetch("/api/commercial", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, data }),
  });
  const result = await res.json();
  if (!res.ok)
    throw new Error(
      commercialErrorLabel(
        result.error || "No se pudo completar la operación.",
      ),
    );
  if (action !== "connections")
    window.dispatchEvent(new Event("commercial-data-changed"));
  return result;
}
import { commercialErrorLabel } from "./feedback";
