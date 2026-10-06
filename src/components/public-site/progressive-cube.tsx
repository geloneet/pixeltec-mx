'use client';

import {forwardRef, useState, type CSSProperties} from 'react';

type Cube = {toggle: () => void; open: () => void; readonly isOpen: boolean};
type Props = {english: boolean; onActivate: () => Promise<Cube | undefined>; style?: CSSProperties};

/** The same approved visual is available without WebGL or an initial GPU stall. */
export const ProgressiveCube = forwardRef<HTMLDivElement, Props>(function ProgressiveCube(
  {english, onActivate, style}, ref,
) {
  const [cube, setCube] = useState<Cube>();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  async function activate() {
    if (busy) return;
    if (cube) {cube.toggle(); setOpen(cube.isOpen); return;}
    setBusy(true);
    try {
      const instance = await onActivate();
      if (instance) {setCube(instance); instance.open(); setOpen(true);}
    } catch {setFailed(true);} finally {setBusy(false);}
  }
  return <div ref={ref} style={style} className="progressive-cube" aria-label="Visual PixelTEC">
    <img className="cube-poster" src="/assets/brand/cube-poster-768.webp"
      srcSet="/assets/brand/cube-poster-480.webp 480w, /assets/brand/cube-poster-768.webp 768w"
      sizes="(max-width: 700px) 90vw, 50vw" width={768} height={768}
      alt={english ? 'PixelTEC blue technology cube' : 'Cubo tecnológico azul de PixelTEC'}
      decoding="async" fetchPriority="high"/>
    <div className="cube-controls">
      {failed ? <span role="status">{english ? '3D unavailable on this device' : '3D no disponible en este dispositivo'}</span> :
        <button type="button" onClick={activate} disabled={busy} aria-expanded={open}>
          {busy ? (english ? 'Preparing 3D…' : 'Preparando 3D…') : open ? (english ? 'Close cube' : 'Cerrar cubo') : (english ? 'Explore in 3D' : 'Explorar en 3D')}
          <span aria-hidden="true"> ↗</span>
        </button>}
    </div>
  </div>;
});
