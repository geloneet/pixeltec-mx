# Decisión local 001: extender el diseño existente como prototipo aislado

Fecha: 2026-10-02. Alcance: únicamente el armazón visual solicitado por Miguel. No sustituye ADRs de NeuroPIXEL ni autoriza despliegue.

Miguel pidió completar las páginas tomando como base el inicio que ya construyó y usando Befox solo como referencia para dudas. El inicio es una exportación DC con HTML, estilos y runtime propio. Rehacerlo con otra plantilla o iniciar una migración productiva contradice el alcance.

Se conserva la exportación original y se generan interiores estáticos a partir de componentes y catálogos TypeScript strict. Los tokens se derivan del inicio: Bricolage Grotesque, negro/blanco/crema, azul #1466ff, cabecera crema, títulos grandes y esquemas modulares. La propuesta de negro/blanco corresponde a la instrucción explícita del usuario; no cambia la identidad de otros productos ni las reglas canónicas.

La desviación temporal respecto al stack Next.js de ADR-0001 y a la implementación visual Tailwind/shadcn de ADR-0003 queda confinada a `design/landingpagepixel2.0`, sin modificar rutas de aplicación, bases de datos o autenticación. No es una nueva elección de stack: sirve para revisar el diseño antes de integrarlo. El coste declarado es mantener el runtime de exportación y luego migrar sus interacciones a componentes de producción.

No se agrega backend de demostración. Contacto, newsletter y acceso muestran confirmación de vista previa; el diagnóstico conserva selecciones solo en memoria de la página. El usuario autorizó contenido provisional: no se inventan nuevas métricas comerciales ni perfiles reales de equipo.

Validación y operación: [README](../README.md). Inventario de rutas: [routes.json](routes.json).
