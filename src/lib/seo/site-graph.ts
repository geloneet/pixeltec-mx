import { SITE, absoluteUrl } from '../site-config';
import { SERVED_CITY_NAMES } from '../content/services-catalog';

// Shared identity graph: production and redesign consume the same public facts.
export const ORG_ID = `${SITE.url}/#organization`;
export const WEBSITE_ID = `${SITE.url}/#website`;

/** `@id` que este módulo publica siempre — el módulo SEO los usa para no
 *  duplicar las mismas entidades desde la base de datos (SEO-03). */
export const CODE_EMITTED_IDS = [ORG_ID, WEBSITE_ID] as const;

const street = (SITE.address as { street?: string }).street;

const organizationSchema = {
  "@type": ["Organization", "ProfessionalService"],
  "@id": ORG_ID,
  name: SITE.name,
  url: SITE.url,
  logo: absoluteUrl(SITE.logoPath),
  image: absoluteUrl(SITE.defaultOgImage),
  description: SITE.description,
  telephone: SITE.phone.schema,
  email: SITE.email,
  address: {
    "@type": "PostalAddress",
    ...(street ? { streetAddress: street } : {}),
    addressLocality: SITE.address.locality,
    addressRegion: SITE.address.region,
    addressCountry: SITE.address.country,
  },
  areaServed: [
    ...SERVED_CITY_NAMES.map((name) => ({ "@type": "City", name })),
    { "@type": "Country", name: "Mexico" },
  ],
  contactPoint: {
    "@type": "ContactPoint",
    telephone: SITE.phone.schema,
    email: SITE.email,
    contactType: "sales",
    areaServed: "MX",
    availableLanguage: ["es"],
  },
  founder: {
    "@type": "Person",
    name: SITE.founder,
    url: absoluteUrl(SITE.founderPath),
  },
  sameAs: SITE.socialProfiles,
  // L6 (WO-2026-00346): enlace a la ficha de Google Business Profile. Sin `geo`:
  // el pin de la ficha no es la sede (ver site-config).
  hasMap: SITE.googleBusinessProfile.url,
};

const webSiteSchema = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: SITE.name,
  url: SITE.url,
  inLanguage: SITE.locale,
  publisher: { "@id": ORG_ID },
};

/**
 * SEO-03 (WO-2026-00268): un solo `<script>` con `@graph` en lugar de dos
 * bloques sueltos. Con `@graph`, Organization y WebSite quedan explícitamente
 * declaradas como parte del mismo grafo del sitio; sueltas, Google tenía que
 * inferir la relación por `@id` y a veces las trataba como entidades ajenas.
 */
export const siteGraph = {
  "@context": "https://schema.org",
  "@graph": [organizationSchema, webSiteSchema],
};
