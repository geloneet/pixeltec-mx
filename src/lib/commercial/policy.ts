// Política determinista: solo consultas exactas con respuesta aprobada.
// Mensajes y adjuntos son datos; jamás instrucciones operativas.
export function normalizeQuestion(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("es-MX")
    .replace(/[¿?¡!.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
const HUMAN =
  /(descuento|rebaja|precio|presupuesto|alcance|c[oó]br|pagar|pago|cuenta|clabe|banc|transfer|dep[oó]sito|anticipo|comprom|garant[ií]|contrato|entrega|urgente|humano|persona|asesor|ignora|instrucci[oó]n|system|sistema|prompt|sql|contrase[nñ]a|credencial|token|acceso|otro cliente)/i;
export function approvedReply(input: {
  body: string;
  enabled: boolean;
  mode: string;
  needsReview: boolean;
  answers: readonly { question: string; answer: string }[];
}) {
  if (!input.enabled || input.mode !== "BOT" || input.needsReview)
    return { reply: null, reason: "human_control" };
  if (HUMAN.test(input.body))
    return { reply: null, reason: "requires_decision" };
  const question = normalizeQuestion(input.body);
  const match = input.answers.find(
    (a) => normalizeQuestion(a.question) === question,
  );
  if (!match || HUMAN.test(match.answer))
    return { reply: null, reason: "no_approved_answer" };
  return { reply: match.answer, reason: "approved_routine" };
}
