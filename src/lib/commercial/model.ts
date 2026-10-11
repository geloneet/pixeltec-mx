export const saleStages = [
  "nuevo",
  "conversacion",
  "cotizacion",
  "cierre",
  "ganado",
] as const;
export const saleStageLabel = {
  nuevo: "Nuevo interés",
  conversacion: "En conversación",
  cotizacion: "Cotización",
  cierre: "Por cerrar",
  ganado: "Ganado",
  pausado: "En pausa",
  perdido: "Perdido",
};
export const projectStages = [
  "arranque",
  "preparacion",
  "revision",
  "entregado",
] as const;
export const projectStageLabel = {
  arranque: "Arranque",
  preparacion: "En preparación",
  revision: "Listo para revisar",
  entregado: "Entregado",
};
