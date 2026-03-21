"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvidenceLinkSchema = exports.EvidenceRefSchema = exports.EvidenceSnippetSchema = void 0;
const zod_1 = require("zod");
const isoUtcString = zod_1.z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'invalid datetime' });
exports.EvidenceSnippetSchema = zod_1.z
    .object({
    snippet_text: zod_1.z.string().max(600),
    snippet_language: zod_1.z.string().min(1),
    extractor_version: zod_1.z.string().min(1),
})
    .strict();
const StructuralSpanSchema = zod_1.z
    .object({
    start_char: zod_1.z.number().int().nonnegative(),
    end_char: zod_1.z.number().int().nonnegative(),
    span_type: zod_1.z.string().min(1),
    confidence: zod_1.z.number().min(0).max(1),
})
    .strict()
    .refine((span) => span.end_char > span.start_char, {
    message: 'end_char must be > start_char',
    path: ['end_char'],
});
exports.EvidenceRefSchema = zod_1.z
    .object({
    normalized_item_id: zod_1.z.string().min(1),
    url: zod_1.z.string().url(),
    published_at: isoUtcString,
    extractor_version: zod_1.z.string().min(1),
    confidence: zod_1.z.number().min(0).max(1),
    extracted_spans: zod_1.z.array(StructuralSpanSchema),
})
    .strict();
exports.EvidenceLinkSchema = zod_1.z
    .object({
    evidence_ref: exports.EvidenceRefSchema,
    evidence_snippet: exports.EvidenceSnippetSchema.optional(),
    role: zod_1.z.enum(['supports', 'contradicts', 'context']),
    link_confidence: zod_1.z.number().min(0).max(1),
})
    .strict();
