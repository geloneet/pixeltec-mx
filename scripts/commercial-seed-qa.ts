/** Fixtures desechables, exclusivamente para Postgres local centro_qa. */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import {
  generateAccessCode,
  hashAccessCode,
} from "../src/lib/client-portal/otp";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  users,
  clients,
  projects,
  commercialOpportunities,
  quotes,
  quoteVersions,
  billingItems,
  paymentRecords,
} from "../src/lib/db/schema";
config({ path: ".env.local" });
const url = new URL(process.env.DATABASE_URL!);
if (
  process.env.NODE_ENV === "production" ||
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  url.pathname !== "/centro_qa" ||
  !process.env.COMMERCIAL_QA_PASSWORD
)
  throw new Error("Solo centro_qa local con contraseña QA configurada.");
const connection = postgres(url.toString(), { max: 1 });
const db = drizzle(connection);
async function main() {
  await db.transaction(async (tx) => {
    const ownerId = "00000000-0000-4000-8000-000000000566";
    await tx
      .insert(users)
      .values({
        id: ownerId,
        email: "centro-qa@example.invalid",
        name: "Prueba Centro",
        passwordHash: await bcrypt.hash(
          process.env.COMMERCIAL_QA_PASSWORD!,
          12,
        ),
        role: "admin",
        status: "active",
      })
      .onConflictDoNothing();
    const names = [
      "Prueba · Interés en sitio web",
      "Prueba · Cotización en revisión",
      "Prueba · Proyecto en preparación",
      "Prueba · Cobro parcial",
    ];
    for (let i = 0; i < names.length; i++) {
      const clientId =
        "00000000-0000-4000-8000-" + String(566100 + i).padStart(12, "0");
      await tx
        .insert(clients)
        .values({
          id: clientId,
          firestoreId: clientId,
          ownerId,
          source: "crm_blob",
          name: names[i],
          contactName: "Contacto de prueba",
          email: "centro" + i + "@example.invalid",
          phone: "+1555000566" + i,
        })
        .onConflictDoNothing();
      await tx
        .insert(commercialOpportunities)
        .values({
          clientId,
          ownerId,
          source: "manual",
          assignedTo: ownerId,
          need:
            i === 0
              ? "Quiere conocer el proceso para crear su sitio web"
              : i === 1
                ? "Revisar la propuesta y acordar el siguiente paso"
                : "Seguimiento de prueba",
          stage: i === 0 ? "nuevo" : i === 1 ? "cotizacion" : "conversacion",
          nextAction:
            i === 0
              ? "Revisar su necesidad y responder"
              : "Confirmar siguiente paso",
          nextActionDue: "2026-10-11",
        })
        .onConflictDoNothing();
      if (i === 2) {
        const id = "00000000-0000-4000-8000-000000566200";
        await tx
          .insert(projects)
          .values({
            id,
            firestoreId: id,
            clientId,
            name: "Sitio web de prueba",
            commercialStage: "preparacion",
            commercialRevision: 1,
            clientNote: "Estamos preparando las páginas acordadas.",
            nextStep: "Revisar los contenidos",
            nextStepDue: "2026-10-14",
          })
          .onConflictDoNothing();
      }
      if (i === 1) {
        const id = "00000000-0000-4000-8000-000000566300";
        const [quote] = await tx
          .insert(quotes)
          .values({
            id,
            clientId,
            folio: "COT-QA-WO566",
            title: "Sitio web de prueba",
            items: [
              {
                description: "Servicio de prueba",
                quantity: 1,
                unitPriceCents: 100000,
              },
            ],
            taxEnabled: true,
            publicToken: randomUUID().replaceAll("-", ""),
            status: "lista",
            validUntil: new Date("2026-11-01T23:59:59Z"),
            problem: "Necesidad de prueba",
            solution: "Solución de prueba",
            scopeIncluded: "Alcance de prueba",
            estimatedDelivery: "Por confirmar",
            createdBy: ownerId,
          })
          .onConflictDoNothing()
          .returning();
        if (quote)
          await tx
            .insert(quoteVersions)
            .values({
              quoteId: id,
              version: 1,
              snapshot: quote,
              createdBy: ownerId,
            })
            .onConflictDoNothing();
      }
      if (i === 3) {
        const id = "00000000-0000-4000-8000-000000566400";
        await tx
          .insert(billingItems)
          .values({
            id,
            ownerId,
            clientId,
            concept: "Servicio de prueba · pago parcial",
            amount: "1160.00",
            currency: "MXN",
            frequency: "unico",
            status: "parcial",
            dueDate: "2026-10-09",
          })
          .onConflictDoNothing();
        await tx
          .insert(paymentRecords)
          .values({
            id: "00000000-0000-4000-8000-000000566401",
            billingItemId: id,
            amount: "400.00",
            method: "transferencia",
            paidAt: "2026-10-08",
            periodKey: "2026-10-09",
            createdBy: ownerId,
            note: "Fixture QA · no representa dinero recibido",
          })
          .onConflictDoNothing();
      }
    }
  });
  if (process.env.COMMERCIAL_QA_PORTAL_CODE_FILE) {
    const path = resolve(process.env.COMMERCIAL_QA_PORTAL_CODE_FILE);
    if (!path.startsWith("/private/tmp/") || !process.env.PORTAL_SESSION_SECRET)
      throw new Error(
        "Portal QA requiere archivo privado temporal y secreto local.",
      );
    const code = generateAccessCode();
    await db
      .update(clients)
      .set({
        portalAccessEnabled: true,
        accessCodeHash: hashAccessCode(code, process.env.PORTAL_SESSION_SECRET),
        accessCodeExpiresAt: new Date(Date.now() + 600000),
      })
      .where(eq(clients.id, "00000000-0000-4000-8000-000000566102"));
    await writeFile(path, code, { mode: 0o600 });
  }
  await connection.end();
  console.log(
    "Fixtures QA preparados. Cuenta y datos exclusivos de centro_qa; ningún envío externo.",
  );
}
void main().catch(async () => {
  await connection.end();
  console.error("No se pudieron preparar los fixtures QA.");
  process.exitCode = 1;
});
