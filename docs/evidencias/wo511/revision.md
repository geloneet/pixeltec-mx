# Revisión de landing — 2026-10-06 · WO-2026-00511

Laterales del encabezado transparentes: solo la tarjeta de navegación conserva fondo. Las secciones se ven a través de los márgenes al desplazarse. Estrellas tipográficas reemplazadas por SVG compartido en ES/EN; compilador actualizado para conservar el cambio al regenerar.

Validación: TypeScript PASS. Navegador a 390 y 320 px sin desbordamiento horizontal; menú abre/cierra, diagnóstico modal Hotel avanza al paso 2 sin navegar. ES/EN con 25 estrellas SVG, encabezado rgba(0,0,0,0), consola sin errores observados. Imágenes cargadas sin naturalWidth=0. Evidencia mobile.png.

Testimonios: Miguel decide «deja iniciales». Se conservan las iniciales en las cinco tarjetas; el pedido de retratos queda sustituido por esta decisión. No hay fotografías faltantes pendientes de este alcance.

Sin cambios de datos ni envíos de prueba. Publicación final confirmada en el cierre inferior.

Compilación del primer candidato 2f981f5d falló antes de activarse: next/font/google Roboto no reconoce extensión de URL (loader.js:122). Se incluye el mismo WOFF2 Latin usado por el build local, con SIL OFL de google/fonts/ofl/roboto, y next/font/local conserva variable, display swap y preload=false. Evita dependencia externa de esta fuente; Poppins/League Spartan no cambian.

QA adicional: popup Villa Nogal en 390px con imagen, texto y CTA dentro del viewport. Nueve pruebas de diagnóstico y consentimiento PASS. El segundo intento del candidato original supera compilación; la corrección local de Roboto queda en d049cdc1 para eliminar la fragilidad observada.

Operación: landing 2f981f5d activada 2026-10-06T18:02:51Z (wrapper rc0, rollback=no). Candidato Roboto d049cdc1 detenido preactivación por ENOSPC: disco 100%,816MB libres. Se eliminó únicamente caché Docker builder no usada de más de una hora (4.136GB reclamados); sin prune de imágenes, contenedores ni volúmenes. Posterior df:5.5GB libres. Reintento gobernado en curso.

## Cierre productivo

Release d049cdc115749617e86b61450f9c1934975b5537 activa 2026-10-06T18:23:25Z, wrapper rc0, rollback=no. Log /home/ubuntu/deploy-logs/pixeltec-mx-20261006T180938Z-d049cdc11574-deploy.log. Salud directa /api/health, / y /login 200; nginx 301 esperado. Recuperación 2f981f5d (landing con correcciones visuales). Build/TypeScript/205 páginas PASS. PR165 y PR166 fusionados.
