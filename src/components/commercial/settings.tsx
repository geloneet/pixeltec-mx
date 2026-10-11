"use client";
import { useEffect, useState, useRef } from "react";
import { useTheme } from "next-themes";
import type { CommercialSnapshot } from "@/lib/commercial/snapshot";
import type { verifyCommercialConnections } from "@/lib/commercial/inbox";
import { commercialAction } from "./api";
export function CommercialSettings({
  data,
  refresh,
}: {
  data: CommercialSnapshot;
  refresh: () => Promise<unknown>;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [connections, setConnections] = useState<Awaited<
    ReturnType<typeof verifyCommercialConnections>
  > | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [answers, setAnswers] = useState(data.policy.approvedAnswers);
  const [automatic, setAutomatic] = useState(data.policy.automaticEnabled);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    try {
      setReduced(localStorage.getItem("commercial-reduced-motion") === "true");
    } catch {
      /* Browser keeps its system preference. */
    }
  }, []);
  async function run(action: string, input: unknown) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setNotice("");
    try {
      const result = await commercialAction(action, input);
      if (action === "connections") setConnections(result);
      else {
        await refresh();
        setNotice("Política guardada.");
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div className="cc-card">
        <h2>Tu espacio</h2>
        <div className="cc-setting">
          <div>
            <h3>Apariencia</h3>
            <p>Elige cómo quieres ver tu Centro Comercial.</p>
          </div>
          <div className="cc-choice">
            <button
              aria-pressed={resolvedTheme === "dark"}
              onClick={() => setTheme("dark")}
            >
              Oscuro
            </button>
            <button
              aria-pressed={resolvedTheme === "light"}
              onClick={() => setTheme("light")}
            >
              Claro
            </button>
          </div>
        </div>
        <div className="cc-setting">
          <div>
            <h3>Movimiento</h3>
            <p>También se respeta la preferencia de tu dispositivo.</p>
          </div>
          <label className="cc-small flex gap-2">
            <input
              type="checkbox"
              checked={reduced}
              onChange={(e) => {
                setReduced(e.target.checked);
                try {
                  localStorage.setItem(
                    "commercial-reduced-motion",
                    String(e.target.checked),
                  );
                  window.dispatchEvent(new Event("commercial-motion-changed"));
                } catch {
                  setNotice(
                    "El navegador no permite guardar esta preferencia.",
                  );
                }
              }}
            />
            Reducir movimiento
          </label>
        </div>
        <div className="cc-setting">
          <div>
            <h3>Conexiones</h3>
            <p>
              Comprueba el proveedor y sus permisos antes de atender o enviar.
            </p>
          </div>
          <button
            className="cc-button"
            disabled={busy}
            onClick={() => run("connections", {})}
          >
            {busy ? "Comprobando…" : "Comprobar conexiones"}
          </button>
        </div>
        {connections && (
          <div className="cc-connection-list">
            {[
              ["WhatsApp", connections.whatsapp],
              ["Correo de salida", connections.email],
              ["Correo entrante", connections.receiving],
              ["Proceso programado", connections.scheduledWork],
              ["Asistente de WhatsApp", connections.whatsappAutomation],
              ["Recordatorios programados", connections.reminders],
            ].map(([name, state]) => (
              <div className="cc-setting" key={String(name)}>
                <div>
                  <h3>{String(name)}</h3>
                  <p>{(state as { reason: string }).reason}</p>
                </div>
                <span
                  className={
                    "cc-tag " +
                    ((state as { verified: boolean }).verified
                      ? "green"
                      : "amber")
                  }
                >
                  {(state as { verified: boolean }).verified
                    ? "Verificado"
                    : "Requiere revisión"}
                </span>
              </div>
            ))}
            <p className="cc-small cc-muted">
              Comprobación:{" "}
              {new Date(connections.checkedAt).toLocaleString("es-MX")}. Un
              recibo de envío y uno de recepción completan la prueba del canal.
            </p>
          </div>
        )}
      </div>
      <div className="cc-card mt-5">
        <h2>Asistente comercial</h2>
        <p className="cc-small cc-muted mt-3">
          Solo responde consultas que coincidan con una respuesta aprobada.
          Precios, descuentos, alcance, pagos, compromisos e incertidumbre
          requieren atención humana.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run("policy", {
              automaticEnabled: automatic,
              tone: f.get("tone"),
              approvedAnswers: answers,
              revision: data.policy.revision,
            });
          }}
        >
          <div className="cc-setting">
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={automatic}
                onChange={(e) => setAutomatic(e.target.checked)}
              />
              Permitir respuestas automáticas aprobadas
            </label>
            <span className="cc-tag">
              {data.policy.automaticEnabled
                ? "Política habilitada"
                : "Control humano"}
            </span>
          </div>
          <label className="cc-field">
            Tono
            <select name="tone" defaultValue={data.policy.tone}>
              <option value="cercano">Cercano</option>
              <option value="formal">Formal</option>
            </select>
          </label>
          {answers.map((answer, i) => (
            <div key={i} className="cc-card mb-3">
              <label className="cc-field">
                Pregunta rutinaria
                <input
                  required
                  maxLength={300}
                  value={answer.question}
                  onChange={(e) =>
                    setAnswers(
                      answers.map((a, j) =>
                        j === i ? { ...a, question: e.target.value } : a,
                      ),
                    )
                  }
                />
              </label>
              <label className="cc-field">
                Respuesta autorizada
                <textarea
                  required
                  maxLength={3000}
                  value={answer.answer}
                  onChange={(e) =>
                    setAnswers(
                      answers.map((a, j) =>
                        j === i ? { ...a, answer: e.target.value } : a,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="cc-button quiet"
                onClick={() => setAnswers(answers.filter((_, j) => j !== i))}
              >
                Quitar respuesta
              </button>
            </div>
          ))}
          <button
            type="button"
            className="cc-button"
            disabled={answers.length >= 50}
            onClick={() =>
              setAnswers([...answers, { question: "", answer: "" }])
            }
          >
            Agregar respuesta aprobada
          </button>
          {automatic && (
            <label className="cc-small flex gap-2 mt-4">
              <input type="checkbox" required />
              Revisé todas las respuestas y autorizo esta política para las
              conversaciones que reactive explícitamente.
            </label>
          )}
          <div className="cc-form-end">
            <button className="cc-button primary" disabled={busy}>
              {busy ? "Guardando…" : "Guardar política"}
            </button>
          </div>
        </form>
      </div>
      {notice && (
        <p className="cc-error mt-4" role="status">
          {notice}
        </p>
      )}
    </>
  );
}
