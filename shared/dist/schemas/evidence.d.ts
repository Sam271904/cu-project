import { z } from 'zod';
export declare const EvidenceSnippetSchema: z.ZodObject<{
    snippet_text: z.ZodString;
    snippet_language: z.ZodString;
    extractor_version: z.ZodString;
}, z.core.$strict>;
export type EvidenceSnippet = z.infer<typeof EvidenceSnippetSchema>;
declare const StructuralSpanSchema: z.ZodObject<{
    start_char: z.ZodNumber;
    end_char: z.ZodNumber;
    span_type: z.ZodString;
    confidence: z.ZodNumber;
}, z.core.$strict>;
export type StructuralSpan = z.infer<typeof StructuralSpanSchema>;
export declare const EvidenceRefSchema: z.ZodObject<{
    normalized_item_id: z.ZodString;
    url: z.ZodString;
    published_at: z.ZodString;
    extractor_version: z.ZodString;
    confidence: z.ZodNumber;
    extracted_spans: z.ZodArray<z.ZodObject<{
        start_char: z.ZodNumber;
        end_char: z.ZodNumber;
        span_type: z.ZodString;
        confidence: z.ZodNumber;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export declare const EvidenceLinkSchema: z.ZodObject<{
    evidence_ref: z.ZodObject<{
        normalized_item_id: z.ZodString;
        url: z.ZodString;
        published_at: z.ZodString;
        extractor_version: z.ZodString;
        confidence: z.ZodNumber;
        extracted_spans: z.ZodArray<z.ZodObject<{
            start_char: z.ZodNumber;
            end_char: z.ZodNumber;
            span_type: z.ZodString;
            confidence: z.ZodNumber;
        }, z.core.$strict>>;
    }, z.core.$strict>;
    evidence_snippet: z.ZodOptional<z.ZodObject<{
        snippet_text: z.ZodString;
        snippet_language: z.ZodString;
        extractor_version: z.ZodString;
    }, z.core.$strict>>;
    role: z.ZodEnum<{
        supports: "supports";
        contradicts: "contradicts";
        context: "context";
    }>;
    link_confidence: z.ZodNumber;
}, z.core.$strict>;
export type EvidenceLink = z.infer<typeof EvidenceLinkSchema>;
export {};
//# sourceMappingURL=evidence.d.ts.map