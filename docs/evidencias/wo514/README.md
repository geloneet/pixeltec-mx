# WO-2026-00514 — Nitidez del cubo de Inicio

6 de octubre de 2026. Miguel reportó borrosidad después de la optimización WO513. La captura anterior incluía textura de fondo y poca definición efectiva del objeto; ampliar esa captura o comprimirla más no resolvía el defecto.

Se renderizó de nuevo el modelo existente de `cube.js` en lienzo1536×1536, fondo negro limpio, patrón fijoD, half2.1 y geometría offline24 segmentos (en lugar de8). La escena interactiva de producción no cambia. El PNG fuente adjunto permite reproducir exportaciones. Exportación sharp/WebP calidad92, effort6:768px=28606bytes,1536px=80068bytes. Nuevos nombres evitan reutilizar caché del póster anterior. Srcset/preload comparten las dos variantes; se conservan dimensiones, alt, carga prioritaria y WebGL solo bajo intención.

Validación: TypeScript PASS y2 pruebas del control progresivo PASS. Comparación visual al mismo tamaño: aristas e iconos definidos, sin fondo de partículas incrustado. La ganancia de CPU de WO513 se conserva por arquitectura; no se atribuyen las puntuaciones anteriores de PageSpeed a esta nueva imagen sin medirla.

Publicación final: `f07514261aa03d72f33ff4121b1562dea80c726b`, 6/10 15:35 México; wrapper rc0, rollback=no. Build/tipos/205 páginas PASS. Portada real sirve srcset HQ nuevo, cero canvas del cubo inicial. Móvil390px: scrollWidth379, imagen cargada y sin overflow. Capturas de producción adjuntas.
