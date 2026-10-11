import { SITE } from "@/lib/site-config";
/** Proxy-safe CSRF boundary: configured public origin, never forwarded Host. */
export function isCommercialOriginAllowed(request: Request) {
  const configured =
    process.env.AUTH_URL || process.env.NEXTAUTH_URL || SITE.url;
  try {
    return request.headers.get("origin") === new URL(configured).origin;
  } catch {
    return false;
  }
}
