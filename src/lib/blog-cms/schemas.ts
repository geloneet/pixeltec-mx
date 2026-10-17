import { z } from 'zod';
import { AI_ARTICLE_TONES } from './ai-params';
import {PostSourceSchema,InternalLinkSchema} from '@/lib/blog/schemas';
import {EditorialSeoSchema,EditorialAiSchema,EditorialAiParamsSchema,EditorialFaqItemSchema} from '@/lib/blog/editorial/content-schema.mjs';

/**
 * Validación en frontera del Blog (WO-2026-00088), espejo del `saveSchema` de
 * Encino (`src/app/actions/blog.ts:46-73`) adaptado al modelo de Pixeltec.mx:
 * el cuerpo es MARKDOWN (`body`), no HTML; la «meta description» alimenta
 * `excerpt` + `seo.metaDescription`; el alt de portada vive en
 * `seo.ogImageAlt`.
 */
export const BLOG_CMS_INTENTS = ['autosave', 'draft', 'publish', 'schedule'] as const;
export type BlogCmsIntent = (typeof BLOG_CMS_INTENTS)[number];

export const FaqItemSchema = EditorialFaqItemSchema;

export const SaveBlogCmsPostSchema = z.object({
  requestKey:z.string().uuid().optional(),
  expectedVersion:z.string().regex(/^(0|[1-9][0-9]*)$/).optional(),
  expectedDigest:z.string().regex(/^[a-f0-9]{64}$/).optional(),
  id: z.string().uuid(),
  title: z.string().max(300),
  body: z.string().max(500_000, 'El contenido es demasiado largo'),
  metaDescription: z.string().max(160),
  seoTitle: EditorialSeoSchema.shape.metaTitle,
  noindex: EditorialSeoSchema.shape.noindex,
  nofollow: EditorialSeoSchema.shape.nofollow,
  slug: z.string().max(120),
  category: z.string().max(80).nullable(),
  newCategory: z.string().max(80).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  faq: z.array(FaqItemSchema).max(20).optional(),
  coverImage: z.string().max(500).nullable(),
  coverImageAlt: z.string().max(200).optional(),
  mapsEmbed: z.string().max(2000).optional(),
  schemaTypes: z.array(z.string().max(60)).max(10).optional(),
  sources:z.array(PostSourceSchema.extend({title:z.string().max(300),url:z.string().max(2000)})).max(20).optional(),
  internalLinks:z.array(InternalLinkSchema.extend({targetUrl:z.string().max(2000),anchor:z.string().max(120)})).max(20).optional(),
  ai:EditorialAiSchema.required().optional(),
  aiParams:EditorialAiParamsSchema.nullable().optional(),
  intent: z.enum(BLOG_CMS_INTENTS),
  scheduledAt: z.string().max(40).optional(),
});
export type SaveBlogCmsPostInput = z.infer<typeof SaveBlogCmsPostSchema>;

export const CategoryNameSchema = z.string().trim().min(1, 'Nombre requerido').max(80);

export const CreateCategorySchema = z.object({
  name: CategoryNameSchema,
  slug: z.string().max(120).optional(),
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().max(500).optional(),
});
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

export const GenerateArticleSchema = z.object({
  postId: z.string().uuid(),
  brief: z.string().min(10).max(10_000),
  tone: z.enum(AI_ARTICLE_TONES),
  audience: z.string().min(3).max(300),
  internalLinkCount: z.number().int().min(0).max(8),
  externalLinkCount: z.number().int().min(0).max(8),
  modification: z.string().min(3).max(2000).optional(),
  currentTitle: z.string().max(300).optional(),
  currentBody: z.string().max(200_000).optional(),
});
export type GenerateArticleInput = z.infer<typeof GenerateArticleSchema>;

export const GenerateFaqSchema = z.object({
  postId: z.string().uuid(),
  count: z.number().int().min(1).max(8),
  title: z.string().max(300),
  body: z.string().max(200_000),
  existingQuestions: z.array(z.string().max(300)).max(20).default([]),
});
export type GenerateFaqInput = z.infer<typeof GenerateFaqSchema>;

/** Resultado que el wizard devuelve al editor (NO se persiste solo). */
export const AiArticleResultSchema = z.object({
  title: z.string().min(3),
  metaDescription: z.string(),
  tags: z.array(z.string()).default([]),
  body: z.string().min(100),
  ai:z.object({model:z.string(),generatedAt:z.string(),editedByHuman:z.boolean(),wordsAdded:z.number(),iterations:z.number()}).optional(),
});
export type AiArticleResult = z.infer<typeof AiArticleResultSchema>;

export const AiFaqResultSchema = z.object({
  faq: z.array(FaqItemSchema).min(1),
});
