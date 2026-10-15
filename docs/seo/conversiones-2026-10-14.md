# ¿Qué se verificó del embudo y qué corrige WO590?

La revisión de código encontró que el formulario de seguimiento del diagnóstico no enviaba el identificador de sesión de contenido que la acción del servidor ya admite. El candidato lo pasa mediante el helper existente, después de validar formulario, consentimiento de contacto y respuestas. No introduce eventos, cookies, proveedores ni campos de DB. Fecha: 14/10/2026; [baseline](baseline-2026-10-14.md).

## Contrato existente observado

| Superficie | Fuente | Comportamiento verificado por lectura/pruebas |
|---|---|---|
| Eventos de contenido | `src/lib/analytics/events.ts` | Catálogo y schemas compartidos; el navegador no puede emitir `lead_created` ni `diagnostic_complete`; rechaza path con query/fragmento |
| Tracker | `src/components/analytics/content-tracker.tsx` | Sesión de pestaña, view/scroll/CTA; un clic de WhatsApp no acredita un lead ni una venta |
| Atribución | `src/lib/analytics/attribution.ts` | First touch conservado, ruta sin query/fragmento, solo host del referrer y tres UTM acotados; no contenido del formulario |
| Consentimiento de seguimiento | `src/lib/analytics/consent.ts` y `meta-pixel.tsx` | Decisión versionada y fail-closed para el píxel de Meta; no se ha cambiado esa política |
| Acción de diagnóstico | `src/app/actions.ts` | Valida respuestas con schema; valida UUID de sesión antes de persistir; crea lead antes de notificar; éxito vinculado al resultado del servidor |
| Formulario de seguimiento | `src/components/public-site/lead-followup.tsx` | Consentimiento de contacto obligatorio; mantiene errores y formulario cuando falla el servicio |

El catálogo declara hitos de servidor, pero esa declaración por sí sola no acredita emisiones reales. La revisión de este lote no los activó ni creó instrumentación paralela. El consentimiento de contacto del formulario y la decisión de seguimiento de Meta son controles distintos; no se declara que el tracker de contenido esté condicionado por el consentimiento de Meta.

## Defecto y cambio local

Antes: el objeto enviado por `LeadFollowup` omitía `sessionId`, aunque `submitDiagnostic` llama al normalizador existente para ese campo. La atribución por cookie podía seguir disponible; el defecto afectaba a la unión de la sesión de contenido, no necesariamente a toda atribución del lead.

Después: reutiliza `getTrackingSessionId()` y pasa el identificador cuando existe. Si no se puede obtener, el envío del lead sigue permitido sin ese campo. No se transmite URL, query string ni contenido adicional. La validación final del UUID sigue en servidor. Se conserva la condición de contacto y no se crea una sesión desde el envío inválido/sin consentimiento.

Una regresión con sesión existente falló antes del cambio (1 fallo, 5 casos aprobados). Después pasan seis casos: falta de consentimiento, respuestas inválidas, éxito confirmado, error del servicio, sesión conservada y ausencia de identificador. Las acciones están simuladas; no se consultó DB ni se mandó email/WhatsApp real.

## Límites y siguiente validación

- La suite existente cubre schemas de eventos, rechazo de datos ajenos, atribución, consentimiento y persistencia simulada. No prueba métricas reales de producción.
- Falta QA aislado del embudo completo y comprobar disponibilidad real de las notificaciones con proveedores simulados/autorizados. No se usaron secretos o DB productiva para esta tarea.
- No se deriva una persona de consultas agregadas de GSC. Los valores UTM son datos de entrada: no se afirma una garantía universal de ausencia de PII solo por limitar campos/longitud.
- No se cambian endpoint, RBAC, dinero ni schema; la revisión no autoriza modificar las rutas excluidas del contrato.
- Publicar la corrección requiere los gates del candidato. Revertir el commit revierte el paso del identificador; no hay migraciones ni datos que retirar.
