import { afterEach, expect, it, vi } from "vitest";
import { isCommercialOriginAllowed } from "./origin";
afterEach(() => vi.unstubAllEnvs());
it("acepta el origen público configurado detrás del proxy y rechaza Host externo", () => {
  vi.stubEnv("AUTH_URL", "https://pixeltec.mx");
  expect(
    isCommercialOriginAllowed(
      new Request("http://app:9002/api/commercial", {
        headers: { origin: "https://pixeltec.mx" },
      }),
    ),
  ).toBe(true);
  expect(
    isCommercialOriginAllowed(
      new Request("http://app:9002/api/commercial", {
        headers: {
          origin: "https://evil.invalid",
          "x-forwarded-host": "evil.invalid",
        },
      }),
    ),
  ).toBe(false);
  expect(
    isCommercialOriginAllowed(new Request("http://app:9002/api/commercial")),
  ).toBe(false);
});
