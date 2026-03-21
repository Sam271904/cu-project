import { z } from 'zod';

const isoUtcString = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'invalid datetime' });

export const EvidenceSnippetSchema = z
  .object({
    snippet_text: z.string().max(600),
    snippet_language: z.string().min(1),
    extractor_version: z.string().min(1),
  })
  .strict();

export type EvidenceSnippet = z.infer<typeof EvidenceSnippetSchema>;

const StructuralSpanSchema = z
  .object({
    start_char: z.number().int().nonnegative(),
    end_char: z.number().int().nonnegative(),
    span_type: z.string().min(1),
    confidence: z.number().min(0).max(1),
  })
  .strict()
  .refine((span) => span.end_char > span.start_char, {
    message: 'end_char must be > start_char',
    path: ['end_char'],
  });

export type StructuralSpan = z.infer<typeof StructuralSpanSchema>;

export const EvidenceRefSchema = z
  .object({
    normalized_item_id: z.string().min(1),
    url: z.string().url(),
    published_at: isoUtcString,
    extractor_version: z.string().min(1),
    confidence: z.number().min(0).max(1),
    extracted_spans: z.array(StructuralSpanSchema),
  })
  .strict();

export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const EvidenceLinkSchema = z
  .object({
    evidence_ref: EvidenceRefSchema,
    evidence_snippet: EvidenceSnippetSchema.optional(),
    role: z.enum(['supports', 'contradicts', 'context']),
    link_confidence: z.number().min(0).max(1),
  })
  .strict();

export type EvidenceLink = z.infer<typeof EvidenceLinkSchema>;

