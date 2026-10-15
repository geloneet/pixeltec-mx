# ¿Qué piloto editorial se propone y qué falta para aplicarlo?

Se proponen dos URL existentes: artículo sobre datos sensibles e IA y consultoría en Bahía de Banderas. Son borradores revisables, **no contenido publicado ni sustituciones ya aplicadas al CMS**. WO590, 14 de octubre de 2026. [Baseline y límites de los datos](baseline-2026-10-14.md).

## Artículo sobre datos sensibles

URL: `/blog/que-datos-nunca-deberias-compartir-con-chatgpt-gemini-o-claude-en-tu-empresa`.

- Evidencia: 232 impresiones, dos clics, posición 7,01 en 14/09–11/10. La intención informativa propuesta es decidir qué información empresarial retirar o anonimizar antes de usar IA. Las consultas exactas por página y competidores observados están pendientes; no se inventan.
- El HTML íntegro actual se revisó: ya contiene seis categorías de datos, anonimización, checklist, FAQ y CTA de diagnóstico/contacto. No se propone duplicar esas secciones. La revisión exacta de campos/revisión del CMS sigue pendiente; debe conservar los recursos existentes.
- Propuesta de título: **Qué datos no compartir con ChatGPT, Gemini o Claude | PixelTEC**.
- Propuesta de H1: **Qué datos de tu empresa no debes compartir con una IA**.
- Introducción propuesta: «Antes de pegar información de tu empresa en una herramienta de IA, identifica si contiene datos personales, credenciales o información confidencial. Esta guía te ayuda a reconocerlos, sustituirlos por ejemplos anónimos y decidir cuándo necesitas un entorno y una autorización adecuados.»
- Secciones a contrastar con el cuerpo íntegro del CMS antes de editar: datos personales y sensibles; contraseñas/tokens; información de clientes y contratos; anonimización de un ejemplo sintético; revisión del proveedor, configuración y autorización; qué hacer ante un envío accidental.
- Ejemplo propuesto, ficticio y rotulado como tal: reemplazar nombre/correo/importe real por «Cliente A», «correo de ejemplo» e importe sintético. No reproducir casos de clientes.
- CTA propuesto: «Revisar el uso de IA en mi empresa», hacia el diagnóstico existente si el flujo confirma ese alcance. El enlace actual y `src/lib/blog/cluster-map.ts` se revisan antes de añadir otro.

Aceptación editorial pendiente: preparar diff de campos contra la revisión del CMS; verificar la mención a sanciones del INAI y la normativa vigente, y las afirmaciones sobre planes/activación de no-entrenamiento con fuentes oficiales actuales. Son afirmaciones encontradas en el contenido actual, no hechos certificados por esta auditoría. No afirmar que todos los proveedores entrenan con todos los datos ni prometer cumplimiento legal por anonimizar. Autor, fechas e imágenes se conservan salvo cambios verificados y aprobados.

## Consultoría Bahía de Banderas

URL: `/consultoria-bahia-de-banderas`.

- Evidencia: descubierta sin indexar en GSC; 200, canonical propio e indexable en HTML. Es una corrección de descubrimiento, independiente de superar un umbral estadístico.
- HTML actual revisado: se dirige a desarrollos inmobiliarios/administradoras y presenta procesos de pagos, mantenimiento y comunicación. Hay enlaces de retorno al servicio y consultoría Puerto Vallarta. La propuesta no debe diluir ese foco sin validación de alcance empresarial.
- Intención propuesta: evaluar consultoría tecnológica para ordenar una necesidad empresarial y priorizar el siguiente proyecto. No implica oficina física en Bahía.
- Propuesta de título: **Consultoría tecnológica en Bahía de Banderas | PixelTEC**.
- Propuesta de H1: **Consultoría tecnológica para negocios de Bahía de Banderas**.
- Introducción propuesta: «Si tu negocio necesita mejorar sus procesos o evaluar una nueva herramienta, el primer paso es entender qué problema resolver. La consultoría de PixelTEC organiza el diagnóstico, las prioridades y una ruta de trabajo antes de decidir qué desarrollar o automatizar.»
- Secciones propuestas: problema y procesos actuales; información necesaria para el diagnóstico; prioridades y entregables según el alcance contratado; adopción y límites; siguiente paso. Se derivan del servicio existente, sin prometer precios, tiempos o resultados no documentados.
- CTA: conservar diagnóstico/contacto existente; revisar destino y funcionamiento sin enviar formularios reales.

Hechos pendientes de validación por Miguel: modalidad y cobertura efectiva del servicio; entregables contractuales precisos; cualquier mención a CANACINTRA/NAFIN, casos o programas debe contar con una fuente específica y vigente. Una fuente municipal o turística genérica no acredita una relación empresarial. No añadir oficinas, domicilios, clientes ni testimonios.

## Matriz propuesta de enlaces

| Origen | Destino | Texto/contexto | Estado y motivo |
|---|---|---|---|
| `/services/consultoria` | `/consultoria-bahia-de-banderas` | «Consultoría tecnológica en Bahía de Banderas», dentro de cobertura del servicio | Falta en HTML; propuesto para descubrimiento desde el hub |
| `/consultoria-puerto-vallarta` | `/consultoria-bahia-de-banderas` | Enlace contextual de cobertura ya existente | Conservar; no duplicarlo |
| Artículo sobre datos sensibles | `/diagnostico` o servicio pertinente según el contenido actual | Próximo paso para revisar procesos/uso de IA | Verificar bloque actual y mapa central antes de añadir |

Los dos destinos comerciales mencionados responden correctamente en el rastreo de producción; el estado debe revalidarse con el candidato. Continuación WO594: fuente del diseño admitida en contrato hijo, cobertura derivada de `CONSULTORIA_CITIES` por el exportador existente y catálogo regenerado. El enlace del hub está preparado en código, sin editar a mano `src/components/public-site/generated/pages.json`. [Evidencia y validación pendiente](../evidencias/wo594/README.md). Los enlaces son `<a href>` descriptivos; no se añaden variaciones de keywords al menú/footer. El contenido CMS y el resto de cambios editoriales siguen como propuesta.

## Qué impide convertir el borrador en publicación

1. Recuperar consulta × página, contexto de 90 días y resultado de la prueba publicada de Bahía. Completar análisis de intención y competidores con observación real.
2. Contrastar los cuerpos públicos ya revisados con su revisión del CMS/fuente y las fuentes empresariales; preparar el diff exacto por campo y fuente de plantilla, con su alcance admitido.
3. Validar enlaces, metadata/schema, accesibilidad y CTA en QA aislado. No modificar fechas para simular frescura.
4. Presentar a Miguel el diff final y obtener los gates correspondientes antes de CMS, merge/deploy o indexación.

Apps y Zapopan continúan como hipótesis por debajo de 100 impresiones; no se agregan otras tres URL para completar una cuota. No hay mapa de redirecciones ejecutable porque no se propone retirar ni consolidar ninguna URL con la evidencia disponible.
