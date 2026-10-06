# Revisión de landing — 2026-10-06 · WO-2026-00511

Laterales del encabezado transparentes: solo la tarjeta de navegación conserva fondo. Las secciones se ven a través de los márgenes al desplazarse. Estrellas tipográficas reemplazadas por SVG compartido en ES/EN; compilador actualizado para conservar el cambio al regenerar.

Validación: TypeScript PASS. Navegador a 390 y 320 px sin desbordamiento horizontal; menú abre/cierra, diagnóstico modal Hotel avanza al paso 2 sin navegar. ES/EN con 25 estrellas SVG, encabezado rgba(0,0,0,0), consola sin errores observados. Imágenes cargadas sin naturalWidth=0. Evidencia mobile.png.

Testimonios: Miguel decide «deja iniciales». Se conservan las iniciales en las cinco tarjetas; el pedido de retratos queda sustituido por esta decisión. No hay fotografías faltantes pendientes de este alcance.

Sin cambios de datos ni envíos de prueba. Publicación pendiente al registrar esta evidencia.

Compilación del primer candidato 2f981f5d falló antes de activarse: next/font/google Roboto no reconoce extensión de URL (loader.js:122). Se incluye el mismo WOFF2 Latin usado por el build local, con SIL OFL de google/fonts/ofl/roboto, y next/font/local conserva variable, display swap y preload=false. Evita dependencia externa de esta fuente; Poppins/League Spartan no cambian.
