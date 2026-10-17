import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Capa de lectura/escritura del Blog (WO-2026-00088) — foco en la lógica que
 * no es "un SELECT más": el throttle del barrido de programados (paridad
 * Encino `publishDueScheduledPosts`) y el bucle de unicidad de slug.
 */

const { updateMock, updateSetMock, updateWhereMock, selectResultQueue } = vi.hoisted(() => {
  const selectResultQueue: unknown[][] = [];
  const updateWhereMock = vi.fn(() => ({ returning: vi.fn(async () => updateWhereMock.mock.results.length ? [] : []) }));
  return { updateMock: vi.fn(), updateSetMock: vi.fn(), updateWhereMock, selectResultQueue };
});

function selectChain() {
  const c: Record<string, unknown> = {};
  c.from = () => c;
  c.where = () => c;
  c.limit = () => c;
  c.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(selectResultQueue.shift() ?? []).then(res, rej);
  return c;
}

const returningMock = vi.fn(async () => [] as Array<{ slug: string }>);

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => selectChain()),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: returningMock })),
      })),
    })),
  },
}));
vi.mock("@/lib/db/schema", () => ({
  blogPosts: { id: {}, slug: {}, status: {}, scheduledAt: {}, publishedAt: {}, updatedAt: {}, title: {}, body: {}, coverImage: {}, category: {} },
  blogCategories: { id: {}, name: {}, slug: {}, parentId: {}, description: {} },
  postRedirects: { fromSlug: {}, postId: {} },
}));
vi.mock("@/lib/blog/queries/posts", () => ({ serializePost: vi.fn((r: unknown) => r) }));

import { publishDueScheduledPosts, resetScheduledSweepThrottle, deleteAbandonedEmptyDrafts, uniqueBlogSlug } from "./queries";

beforeEach(() => {
  vi.clearAllMocks();
  returningMock.mockResolvedValue([]);
  resetScheduledSweepThrottle();
});

describe("render compatibility — no publication or cleanup side effects", () => {
  test("forced call cannot publish even when UPDATE would return overdue posts", async () => {
    returningMock.mockResolvedValueOnce([{ slug: "post-vencido" }]);
    expect(await publishDueScheduledPosts({ force: true })).toEqual([]);
    expect(returningMock).not.toHaveBeenCalled();
  });
  test("repeated reads at arbitrary dates remain pure", async () => {
    for (const date of ["2026-08-25T12:00:00Z", "2026-08-25T12:01:30Z"]) {
      expect(await publishDueScheduledPosts({ now: new Date(date) })).toEqual([]);
    }
    expect(returningMock).not.toHaveBeenCalled();
  });
  test("admin list cannot delete empty drafts", async () => {
    expect(await deleteAbandonedEmptyDrafts()).toBe(0);
  });
});

describe("uniqueBlogSlug — dedupe con sufijo -2, -3… evitando redirects históricos", () => {
  test("slug libre: se devuelve tal cual", async () => {
    selectResultQueue.push([], []); // sin choque de post, sin choque de redirect
    const slug = await uniqueBlogSlug("mi-articulo");
    expect(slug).toBe("mi-articulo");
  });

  test("colisión con un post existente → agrega -2", async () => {
    selectResultQueue.push([{ id: "otro-post" }], []); // choque post, sin choque redirect
    selectResultQueue.push([], []); // mi-articulo-2 libre
    const slug = await uniqueBlogSlug("mi-articulo");
    expect(slug).toBe("mi-articulo-2");
  });

  test("colisión con un redirect histórico también fuerza el siguiente sufijo", async () => {
    selectResultQueue.push([], [{ fromSlug: "mi-articulo" }]); // sin post, pero hay redirect
    selectResultQueue.push([], []); // -2 libre
    const slug = await uniqueBlogSlug("mi-articulo");
    expect(slug).toBe("mi-articulo-2");
  });

  test("más de 50 intentos → lanza (protección contra loops)", async () => {
    for (let i = 0; i < 60; i++) selectResultQueue.push([{ id: "x" }], []);
    await expect(uniqueBlogSlug("colisiona")).rejects.toThrow("No se pudo generar una URL única.");
  });
});
