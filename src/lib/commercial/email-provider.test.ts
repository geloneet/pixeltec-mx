import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const receiving = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { receiving };
  },
}));
import {
  getCommercialReceivedEmail,
  listCommercialReceivedEmails,
} from "@/lib/email";

describe("Recuperación Resend: lecturas acotadas y errores saneados", () => {
  beforeEach(() => {
    receiving.list.mockReset();
    receiving.get.mockReset();
    vi.stubEnv("COMMERCIAL_EMAIL_RECEIVING_ENABLED", "true");
    vi.stubEnv("RESEND_API_KEY", "re_test_only");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });
  const success = {
    data: { data: [], has_more: false },
    error: null,
    headers: {},
  };
  function throttle(seconds = "1") {
    return {
      data: null,
      error: {
        name: "rate_limit_exceeded",
        statusCode: 429,
        message: "Private provider detail",
      },
      headers: { "retry-after": seconds },
    };
  }
  it("consulta como máximo una página con cursor del proveedor", async () => {
    receiving.list.mockResolvedValue(success);
    expect(await listCommercialReceivedEmails("cursor")).toEqual(success.data);
    expect(receiving.list).toHaveBeenCalledExactlyOnceWith({
      limit: 100,
      after: "cursor",
    });
  });
  it("respeta retry-after en una lectura rechazada por ritmo", async () => {
    vi.useFakeTimers();
    receiving.list
      .mockResolvedValueOnce(throttle("2"))
      .mockResolvedValue(success);
    const result = listCommercialReceivedEmails();
    await vi.advanceTimersByTimeAsync(1999);
    expect(receiving.list).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toEqual(success.data);
    expect(receiving.list).toHaveBeenCalledTimes(2);
  });
  it("tres rechazos agotan el presupuesto y no revelan el body del proveedor", async () => {
    vi.useFakeTimers();
    receiving.get.mockResolvedValue(throttle());
    const failure = expect(
      getCommercialReceivedEmail("test-id"),
    ).rejects.toThrow("email_receiving_provider_failed");
    await vi.advanceTimersByTimeAsync(2000);
    await failure;
    expect(receiving.get).toHaveBeenCalledTimes(3);
  });
  it("un retry-after mayor que el presupuesto no se adelanta ni repite", async () => {
    receiving.list.mockResolvedValue(throttle("60"));
    await expect(listCommercialReceivedEmails()).rejects.toThrow(
      "email_receiving_provider_failed",
    );
    expect(receiving.list).toHaveBeenCalledTimes(1);
  });
  it("rechazo de credencial no se reintenta", async () => {
    receiving.list.mockResolvedValue({
      data: null,
      error: { name: "invalid_api_key", message: "Private key detail" },
      headers: {},
    });
    await expect(listCommercialReceivedEmails()).rejects.toThrow(
      "email_receiving_provider_failed",
    );
    expect(receiving.list).toHaveBeenCalledTimes(1);
  });
  it("sin habilitación explícita no consulta nada", async () => {
    vi.stubEnv("COMMERCIAL_EMAIL_RECEIVING_ENABLED", "false");
    await expect(listCommercialReceivedEmails()).rejects.toThrow(
      "email_receiving_not_configured",
    );
    await expect(getCommercialReceivedEmail("id")).rejects.toThrow(
      "email_receiving_not_configured",
    );
    expect(receiving.list).not.toHaveBeenCalled();
    expect(receiving.get).not.toHaveBeenCalled();
  });
});
