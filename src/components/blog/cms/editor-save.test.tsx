// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EMPTY_EDITORIAL, EMPTY_SEO, type BlogPostSerialized } from "@/lib/blog/types";

const { toastMock, actionsMock, aiMock, routerMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
  actionsMock: {
    discardEmptyBlogCmsDraft: vi.fn().mockResolvedValue({ ok: true, data: { deleted: false } }),
    restoreBlogCmsRevision: vi.fn(),
    saveBlogCmsPost: vi.fn(),
  },
  aiMock: {
    generateBlogCmsArticle: vi.fn(),
    generateBlogCmsFaq: vi.fn(),
  },
  routerMock: { replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/lib/blog-cms/actions", () => actionsMock);
vi.mock("@/lib/blog-cms/ai", () => aiMock);
vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
const editorHolder = vi.hoisted(() => ({ current: null as import("@tiptap/react").Editor | null }));
vi.mock("@tiptap/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tiptap/react")>();
  return { ...actual, useEditor: (...args: Parameters<typeof actual.useEditor>) => {
    const editor = actual.useEditor(...args);
    editorHolder.current = editor;
    return editor;
  } };
});
vi.mock("next/dynamic", async () => {
  const { default: RichMarkdownEditor } = await import("@/components/blog/rich-markdown-editor");
  return { default: () => RichMarkdownEditor };
});
// UnsplashPicker importa `searchCoverImages` (server action con
// `requireUserSession` → next-auth), que no resuelve en el entorno de test —
// ajeno a lo que este WO prueba (ver bitácora: backend de Unsplash sin
// cambios en WO-2026-00198).
vi.mock("@/components/blog/cms/unsplash-picker", () => ({
  UnsplashPicker: () => null,
}));

import { BlogCmsEditor } from "./editor";

function fullPost(overrides: Partial<BlogPostSerialized> = {}): BlogPostSerialized {
  return {
    id: "post-1",
    slug: "articulo-de-prueba",
    title: "Título original",
    excerpt: "Extracto de prueba.",
    body: "Cuerpo original.",
    category: "arquitectura",
    tags: [],
    coverImage: null,
    author: { name: "Administrador", uid: "uid-1" },
    status: "draft",
    briefSource: { topic: "", angle: "", targetAudience: "", keyPoints: [], tone: "" },
    ai: { model: "", generatedAt: "2026-08-04T00:00:00.000Z", editedByHuman: false, wordsAdded: 0, iterations: 0 },
    seo: { ...EMPTY_SEO },
    editorial: { ...EMPTY_EDITORIAL },
    sources: [],
    internalLinks: [],
    wordCount: 0,
    readingTimeMin: 0,
    createdAt: "2026-09-03T00:00:00.000Z",
    updatedAt: "2026-09-03T00:00:00.000Z",
    publishedAt: null,
    scheduledAt: null,
    faq: [],
    mapsEmbed: null,
    aiParams: null,
    approvedBy: null,
    ...overrides,
  };
}


function receipt(version = "2") {
  return { ok: true, data: { version, digest: "digest-" + version, status: "draft", publishedAt: null, scheduledAt: null } };
}
beforeEach(() => {
  editorHolder.current = null;
  Object.values(toastMock).forEach(fn => fn.mockReset());
  actionsMock.saveBlogCmsPost.mockReset().mockResolvedValue(receipt());
  actionsMock.discardEmptyBlogCmsDraft.mockResolvedValue({ ok: true, data: { deleted: false } });
  routerMock.refresh.mockReset();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
async function openEditor() {
  render(<BlogCmsEditor post={fullPost()} categories={[]} revisions={[]} isAdmin startWithAi={false} />);
  await waitFor(() => expect(editorHolder.current).toBeTruthy());
}
function typeBody(body: string) {
  act(() => { editorHolder.current!.commands.setContent(body, true); });
}
function save() { fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" })); }

describe("guardado del cuerpo real antes del debounce", () => {
  it("guardar sin editar conserva el Markdown original sin volver a serializarlo", async () => {
    await openEditor();
    const serialize = vi.spyOn(editorHolder.current!.storage.markdown, "getMarkdown");
    save();
    await waitFor(() => expect(actionsMock.saveBlogCmsPost).toHaveBeenCalledTimes(1));
    expect(actionsMock.saveBlogCmsPost.mock.calls[0][0].body).toBe("Cuerpo original.");
    expect(serialize).not.toHaveBeenCalled();
  });

  it("teclear y Guardar inmediatamente envía el último cuerpo", async () => {
    await openEditor();
    typeBody("Último cuerpo sin esperar el debounce.");
    save();
    await waitFor(() => expect(actionsMock.saveBlogCmsPost).toHaveBeenCalledTimes(1));
    expect(actionsMock.saveBlogCmsPost.mock.calls[0][0].body).toBe("Último cuerpo sin esperar el debounce.");
  });

  it("serializa los guardados concurrentes y preserva las ediciones durante el primero", async () => {
    let resolveFirst!: (v: ReturnType<typeof receipt>) => void;
    actionsMock.saveBlogCmsPost.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }));
    await openEditor();
    typeBody("Primera edición inmediata."); save();
    await waitFor(() => expect(actionsMock.saveBlogCmsPost).toHaveBeenCalledTimes(1));
    expect(actionsMock.saveBlogCmsPost.mock.calls[0][0].body).toBe("Primera edición inmediata.");
    typeBody("Segunda edición mientras guarda.");
    // Autosave and an explicit save share the same queue. The disabled button
    // prevents a second click while the first operation is pending.
    await act(async () => { resolveFirst(receipt()); });
    expect(screen.queryByText(/Guardado a las/)).toBeNull();
    save(); save();
    await waitFor(() => expect(actionsMock.saveBlogCmsPost.mock.calls.length).toBeGreaterThanOrEqual(2));
    const second = actionsMock.saveBlogCmsPost.mock.calls[1][0];
    expect(second.body).toBe("Segunda edición mientras guarda.");
    expect(second.expectedVersion).toBe("2");
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar borrador" }).hasAttribute("disabled")).toBe(false));
  });

  it("un fallo de serialización conserva contenido, no envía cuerpo viejo ni anuncia éxito, y permite reintentar", async () => {
    await openEditor(); typeBody("Contenido que debe sobrevivir al error.");
    const storage = editorHolder.current!.storage.markdown;
    const serialize = storage.getMarkdown;
    storage.getMarkdown = () => { throw new Error("SERIALIZATION_FIXTURE_FAILURE"); };
    save();
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(actionsMock.saveBlogCmsPost).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
    expect(editorHolder.current!.getText()).toBe("Contenido que debe sobrevivir al error.");
    expect(screen.queryByText(/Guardado a las/)).toBeNull();
    storage.getMarkdown = serialize;
    save();
    await waitFor(() => expect(actionsMock.saveBlogCmsPost).toHaveBeenCalledTimes(1));
    expect(actionsMock.saveBlogCmsPost.mock.calls[0][0].body).toBe("Contenido que debe sobrevivir al error.");
  });

  it("el error del debounce y autosave se contiene sin perder el texto", async () => {
    await openEditor(); vi.useFakeTimers();
    typeBody("Texto protegido incluso si falla el timer.");
    const storage = editorHolder.current!.storage.markdown;
    const serialize = storage.getMarkdown;
    storage.getMarkdown = () => { throw new Error("SERIALIZATION_FIXTURE_FAILURE"); };
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(screen.getByRole("alert").textContent).toContain("El texto sigue en el editor");
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(actionsMock.saveBlogCmsPost).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalled();
    expect(editorHolder.current!.getText()).toBe("Texto protegido incluso si falla el timer.");
    storage.getMarkdown = serialize;
  });

  it("editar invalida inmediatamente la revisión antes de serializar", async () => {
    render(<BlogCmsEditor post={fullPost()} categories={[]} revisions={[]} isAdmin startWithAi={false} revisionReviewed />);
    await waitFor(() => expect(editorHolder.current).toBeTruthy());
    expect(screen.getByRole("button", { name: "Publicar" }).hasAttribute("disabled")).toBe(false);
    typeBody("Cambio que todavía no llegó al formulario.");
    expect(screen.getByRole("button", { name: "Publicar" }).hasAttribute("disabled")).toBe(true);
  });

  it("FAQ recibe el cuerpo actual aunque se abra antes del debounce", async () => {
    await openEditor();
    fireEvent.click(screen.getByRole("tab", { name: "Contenido" }));
    const body = "Contenido actual suficientemente largo para generar preguntas frecuentes sin esperar el debounce.";
    typeBody(body);
    fireEvent.click(screen.getByRole("button", { name: "Insertar con IA" }));
    aiMock.generateBlogCmsFaq.mockResolvedValue({ ok: true, data: { faq: [] } });
    fireEvent.click(screen.getByRole("button", { name: "Insertar" }));
    await waitFor(() => expect(aiMock.generateBlogCmsFaq).toHaveBeenCalled());
    expect(aiMock.generateBlogCmsFaq.mock.calls[0][0].body).toBe(body);
  });

  it("autosave toma el cuerpo vigente", async () => {
    await openEditor(); vi.useFakeTimers();
    typeBody("Último cuerpo del autosave.");
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(actionsMock.saveBlogCmsPost).toHaveBeenCalledTimes(1);
    expect(actionsMock.saveBlogCmsPost.mock.calls[0][0]).toMatchObject({ intent: "autosave", body: "Último cuerpo del autosave." });
  });

  it.each(["error-before-receipt", "receipt-before-error"])("un recibo antiguo conserva B pendiente: %s", async order => {
    let resolveA!: (v: ReturnType<typeof receipt>) => void;
    let resolveB!: (v: ReturnType<typeof receipt>) => void;
    actionsMock.saveBlogCmsPost
      .mockImplementationOnce(() => new Promise(resolve => { resolveA = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveB = resolve; }));
    await openEditor(); vi.useFakeTimers();
    typeBody("Versión A enviada."); save();
    await act(async () => { await Promise.resolve(); });
    typeBody("Versión B local pendiente que no pudo serializarse.");
    const storage = editorHolder.current!.storage.markdown, serialize = storage.getMarkdown;
    storage.getMarkdown = () => { throw new Error("REVIEW_SYNTHETIC_SERIALIZATION_FAILURE"); };
    if (order === "error-before-receipt") {
      await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    }
    await act(async () => { resolveA(receipt("2")); });
    if (order === "receipt-before-error") {
      await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    }
    expect(screen.getByRole("alert").textContent).toContain("El texto sigue en el editor");
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
    expect(screen.queryByText(/Guardado a las/)).toBeNull();
    expect(editorHolder.current!.getText()).toBe("Versión B local pendiente que no pudo serializarse.");
    const leave = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(leave);
    expect(leave.defaultPrevented).toBe(true);
    // A queued retry that still cannot serialize must not clear the error.
    save(); await act(async () => { await Promise.resolve(); });
    expect(screen.getByText("Error al guardar")).toBeTruthy();
    expect(actionsMock.saveBlogCmsPost).toHaveBeenCalledTimes(1);
    storage.getMarkdown = serialize; save();
    await act(async () => { await Promise.resolve(); });
    expect(actionsMock.saveBlogCmsPost.mock.calls[1][0]).toMatchObject({ body: "Versión B local pendiente que no pudo serializarse.", expectedVersion: "2", expectedDigest: "digest-2" });
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(screen.getByText("Error al guardar")).toBeTruthy();
    await act(async () => { resolveB(receipt("3")); });
    expect(toastMock.success).toHaveBeenCalledExactlyOnceWith("Borrador privado guardado");
    expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Guardado a las/)).toBeTruthy();
    const after = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it("encadena recibos en orden y sólo confirma la última edición guardada", async () => {
    let resolveA!: (v: ReturnType<typeof receipt>) => void;
    let resolveB!: (v: ReturnType<typeof receipt>) => void;
    actionsMock.saveBlogCmsPost
      .mockImplementationOnce(() => new Promise(resolve => { resolveA = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveB = resolve; }));
    await openEditor(); vi.useFakeTimers();
    typeBody("A en vuelo."); save(); await act(async () => { await Promise.resolve(); });
    typeBody("B durante A.");
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    // Autosave is queued behind A; there is no second network request whose
    // receipt could overtake A, even after its timer expires.
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(actionsMock.saveBlogCmsPost).toHaveBeenCalledTimes(1);
    await act(async () => { resolveA(receipt("2")); });
    expect(actionsMock.saveBlogCmsPost).toHaveBeenCalledTimes(2);
    expect(actionsMock.saveBlogCmsPost.mock.calls[1][0]).toMatchObject({ body: "B durante A.", expectedVersion: "2" });
    expect(toastMock.success).not.toHaveBeenCalled();
    typeBody("C posterior a la petición B.");
    await act(async () => { resolveB(receipt("3")); });
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(screen.queryByText(/Guardado a las/)).toBeNull();
    save(); await act(async () => { await Promise.resolve(); });
    expect(actionsMock.saveBlogCmsPost.mock.calls[2][0]).toMatchObject({ body: "C posterior a la petición B.", expectedVersion: "3" });
    expect(toastMock.success).toHaveBeenCalledExactlyOnceWith("Borrador privado guardado");
  });


  it.each(["reject", "server-error"])("un fallo antiguo no sustituye el error de B: %s", async failure => {
    let rejectA!: (e: Error) => void;
    let resolveA!: (v: unknown) => void;
    actionsMock.saveBlogCmsPost.mockImplementationOnce(() => new Promise((resolve, reject) => { resolveA=resolve;rejectA=reject; }));
    await openEditor(); vi.useFakeTimers();
    typeBody("A enviada."); save(); await act(async () => { await Promise.resolve(); });
    typeBody("B con error posterior.");
    const storage=editorHolder.current!.storage.markdown,serialize=storage.getMarkdown;
    storage.getMarkdown=()=>{throw Error("SERIALIZATION_FIXTURE_FAILURE");};
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    await act(async () => { if(failure==="reject")rejectA(Error("OLD_NETWORK_ERROR"));else resolveA({ok:false,error:"OLD_SERVER_ERROR"}); });
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("El texto sigue en el editor");
    expect(editorHolder.current!.getText()).toBe("B con error posterior.");
    storage.getMarkdown=serialize;
  });

  it.each(["publish", "schedule"])("un recibo %s antiguo identifica su versión sin confirmar B", async intent => {
    let resolveA!: (v: ReturnType<typeof receipt>) => void;
    actionsMock.saveBlogCmsPost.mockImplementationOnce(() => new Promise(resolve => { resolveA=resolve; }));
    render(<BlogCmsEditor post={fullPost()} categories={[]} revisions={[]} isAdmin startWithAi={false} revisionReviewed />);
    await waitFor(() => expect(editorHolder.current).toBeTruthy()); vi.useFakeTimers();
    if(intent==="publish")fireEvent.click(screen.getByRole("button",{name:"Publicar"}));
    else {
      fireEvent.click(screen.getByRole("button",{name:"Programar entrada"}));
      // This is an isolated action mock; no publication/scheduling occurs.
      const input=document.querySelector('input[type="datetime-local"]')!;
      fireEvent.change(input,{target:{value:"2027-01-01T12:00"}});
      fireEvent.click(screen.getByRole("button",{name:"Programar"}));
    }
    await act(async () => { await Promise.resolve(); });
    expect(actionsMock.saveBlogCmsPost).toHaveBeenCalledTimes(1);
    typeBody("B todavía pendiente.");
    await act(async () => { resolveA(receipt("2")); });
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.message).toHaveBeenCalledExactlyOnceWith(`Versión 2 ${intent==="publish"?"publicada":"programada"}. Hay cambios posteriores sin guardar.`);
    expect(routerMock.refresh).not.toHaveBeenCalled();
    expect(screen.queryByText(/Guardado a las/)).toBeNull();
  });

});
