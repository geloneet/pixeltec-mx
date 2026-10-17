import {z} from 'zod';

// JSONB has no nested type constraints. All editorial writers validate these
// structures here before a revision can reach persistence or publication.
export const EditorialSeoSchema=z.object({
 metaTitle:z.string().max(70).optional(),metaDescription:z.string().max(160).optional(),
 canonicalUrl:z.union([z.literal(''),z.string().max(2000).url().refine(v=>/^https?:\/\//.test(v))]).nullable().optional(),
 noindex:z.boolean().optional(),nofollow:z.boolean().optional(),
 primaryKeyword:z.string().max(120).optional(),secondaryKeywords:z.array(z.string().min(1).max(120)).max(10).optional(),
 searchIntent:z.enum(['','informational','commercial-investigation','transactional','navigational']).optional(),
 contentPillar:z.string().max(120).optional(),ogImageAlt:z.string().max(200).optional(),
 coverAttribution:z.string().max(200).optional(),schemaTypes:z.array(z.string().max(60)).max(10).optional(),
 contentRole:z.enum(['awareness','consideration','commercial']).optional(),
}).strict();
export const EditorialAiSchema=z.object({
 model:z.string().max(100).optional(),generatedAt:z.string().max(40).optional(),editedByHuman:z.boolean().optional(),
 wordsAdded:z.number().int().nonnegative().optional(),iterations:z.number().int().nonnegative().optional(),
}).strict();
export const EditorialAiParamsSchema=z.object({
 brief:z.string().max(10000),tone:z.string().max(100),audience:z.string().max(300),
 internalLinkCount:z.number().int().min(0).max(8),externalLinkCount:z.number().int().min(0).max(8),
}).strict();
export const EditorialFaqItemSchema=z.object({question:z.string().max(300),answer:z.string().max(2000)}).strict();
export const EditorialNestedSchema=z.object({
 seo:EditorialSeoSchema,ai:EditorialAiSchema,aiParams:EditorialAiParamsSchema.nullable(),
 faq:z.array(EditorialFaqItemSchema).max(20),
}).strict();

export const PostSourceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(3, 'Título de la fuente muy corto').max(300),
  url: z.string().url('URL de fuente inválida'),
  publisher: z.string().max(200).default(''),
  sourceType: z.enum([
    'official',
    'primary-research',
    'regulation',
    'technical-documentation',
    'reputable-secondary',
    'pixeltec-evidence',
  ]),
  claimSupported: z.string().max(500).default(''),
  accessedAt: z.string().default(''),
  verifiedByHuman: z.boolean().default(false),
});

export const InternalLinkSchema = z.object({
  targetUrl: z.string().min(1).refine((u) => u.startsWith('/') || u.startsWith('https://pixeltec.mx'), {
    message: 'El enlace interno debe ser relativo (/ruta) o del propio dominio',
  }),
  anchor: z.string().min(2, 'Anchor descriptivo requerido').max(120),
  placement: z.string().max(200).optional(),
  verified: z.boolean().default(false),
});


export const EditorialContentSchema=EditorialNestedSchema.extend({
 title:z.string().max(300),excerpt:z.string().max(160),body:z.string().max(500000),
 slug:z.string().max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),category:z.string().max(80),
 tags:z.array(z.string().max(50)).max(20),coverImage:z.string().max(2000).nullable(),mapsEmbed:z.string().max(2000).nullable(),
 sources:z.array(PostSourceSchema).max(20),internalLinks:z.array(InternalLinkSchema).max(20),
}).strict();
