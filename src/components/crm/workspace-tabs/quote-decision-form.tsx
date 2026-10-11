'use client';
import { useState } from 'react';
export function QuoteDecisionForm({ token, version, closed }: { token: string; version: number; closed: boolean }) {
  const [decision, setDecision] = useState<'accept' | 'changes'>('accept');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(closed);
  return <section className="mt-8 rounded-xl border border-border p-6" aria-labelledby="quote-decision-title">
    <h2 id="quote-decision-title" className="text-xl font-semibold">Tu decisión · versión {version}</h2>
    {done ? <p className="mt-3" role="status">{message || 'Esta versión ya tiene una aceptación registrada. PixelTEC confirmará los siguientes pasos.'}</p> : <form className="mt-4 space-y-4" onSubmit={async (event) => {
      event.preventDefault(); if (busy) return; setBusy(true); setMessage('');
      const form = new FormData(event.currentTarget);
      try {
        const res = await fetch('/api/commercial/quotes/' + encodeURIComponent(token) + '/decision', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version, decision, actorName: form.get('actorName'), comment: form.get('comment') || '' }) });
        const result = await res.json(); if (!res.ok) throw new Error(result.error || 'No se pudo registrar la decisión.');
        setDone(true); setMessage(decision === 'accept' ? 'Tu aceptación quedó registrada. PixelTEC confirmará el arranque conforme a las condiciones de la cotización.' : 'Registramos los cambios que solicitas. PixelTEC te responderá con la propuesta actualizada.');
      } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo registrar la decisión.'); }
      finally { setBusy(false); }
    }}>
      <label className="block">Nombre de quien decide<input className="mt-1 block w-full rounded-md border border-border bg-background p-2" name="actorName" required maxLength={200} autoComplete="name" /></label>
      <fieldset className="flex flex-wrap gap-5"><legend className="mb-2">¿Cómo quieres continuar?</legend>
        <label><input type="radio" name="decision" checked={decision === 'accept'} onChange={() => setDecision('accept')} /> Aceptar esta versión</label>
        <label><input type="radio" name="decision" checked={decision === 'changes'} onChange={() => setDecision('changes')} /> Solicitar cambios</label>
      </fieldset>
      <label className="block">{decision === 'changes' ? 'Cambios que necesitas' : 'Comentario (opcional)'}<textarea name="comment" required={decision === 'changes'} maxLength={2000} className="mt-1 block w-full rounded-md border border-border bg-background p-2" rows={3} /></label>
      {decision === 'accept' && <label className="flex gap-2"><input type="checkbox" required /><span>Revisé esta versión, sus conceptos, vigencia y condiciones. Confirmo mi aceptación.</span></label>}
      <p className="text-sm text-muted-foreground">El enlace permite decidir sobre esta cotización. Conservaremos el nombre declarado, la versión y la fecha de tu decisión.</p>
      {message && <p role="alert">{message}</p>}
      <button disabled={busy} className="rounded-md bg-[#1466FF] px-4 py-2 font-medium text-white disabled:opacity-50">{busy ? 'Registrando…' : decision === 'accept' ? 'Confirmar aceptación' : 'Enviar solicitud de cambios'}</button>
    </form>}
  </section>;
}
