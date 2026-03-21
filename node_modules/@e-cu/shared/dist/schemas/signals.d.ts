import { z } from 'zod';
export declare const ChangePolicySchema: z.ZodEnum<{
    LATEST_WINS: "LATEST_WINS";
    EVIDENCE_WEIGHTED: "EVIDENCE_WEIGHTED";
    SOURCE_TRUSTED: "SOURCE_TRUSTED";
    USER_OVERRIDE: "USER_OVERRIDE";
}>;
export type ChangePolicy = z.infer<typeof ChangePolicySchema>;
export declare const ChangeTypeSchema: z.ZodEnum<{
    unknown: "unknown";
    added: "added";
    corrected: "corrected";
    inverted: "inverted";
    supplemented: "supplemented";
}>;
export type ChangeType = z.infer<typeof ChangeTypeSchema>;
export declare const ChangeSignalSchema: z.ZodObject<{
    evidence_links: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strict>>;
    change_policy_used: z.ZodEnum<{
        LATEST_WINS: "LATEST_WINS";
        EVIDENCE_WEIGHTED: "EVIDENCE_WEIGHTED";
        SOURCE_TRUSTED: "SOURCE_TRUSTED";
        USER_OVERRIDE: "USER_OVERRIDE";
    }>;
    change_summary: z.ZodString;
    change_type: z.ZodEnum<{
        unknown: "unknown";
        added: "added";
        corrected: "corrected";
        inverted: "inverted";
        supplemented: "supplemented";
    }>;
}, z.core.$strict>;
export type ChangeSignal = z.infer<typeof ChangeSignalSchema>;
export declare const RiskSignalSchema: z.ZodObject<{
    evidence_links: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strict>>;
    change_policy_used: z.ZodEnum<{
        LATEST_WINS: "LATEST_WINS";
        EVIDENCE_WEIGHTED: "EVIDENCE_WEIGHTED";
        SOURCE_TRUSTED: "SOURCE_TRUSTED";
        USER_OVERRIDE: "USER_OVERRIDE";
    }>;
    risk_summary: z.ZodString;
}, z.core.$strict>;
export type RiskSignal = z.infer<typeof RiskSignalSchema>;
export declare const OpportunitySignalSchema: z.ZodObject<{
    evidence_links: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strict>>;
    change_policy_used: z.ZodEnum<{
        LATEST_WINS: "LATEST_WINS";
        EVIDENCE_WEIGHTED: "EVIDENCE_WEIGHTED";
        SOURCE_TRUSTED: "SOURCE_TRUSTED";
        USER_OVERRIDE: "USER_OVERRIDE";
    }>;
    opportunity_summary: z.ZodString;
}, z.core.$strict>;
export type OpportunitySignal = z.infer<typeof OpportunitySignalSchema>;
export declare const DisagreementSignalSchema: z.ZodObject<{
    evidence_links: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strict>>;
    change_policy_used: z.ZodEnum<{
        LATEST_WINS: "LATEST_WINS";
        EVIDENCE_WEIGHTED: "EVIDENCE_WEIGHTED";
        SOURCE_TRUSTED: "SOURCE_TRUSTED";
        USER_OVERRIDE: "USER_OVERRIDE";
    }>;
    dispute_summary: z.ZodString;
    sides: z.ZodArray<z.ZodString>;
    coverage_gaps: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export type DisagreementSignal = z.infer<typeof DisagreementSignalSchema>;
export declare const DecisionSignalsSchema: z.ZodObject<{
    cluster_id: z.ZodString;
    signal_schema_version: z.ZodString;
    change_policy_used: z.ZodEnum<{
        LATEST_WINS: "LATEST_WINS";
        EVIDENCE_WEIGHTED: "EVIDENCE_WEIGHTED";
        SOURCE_TRUSTED: "SOURCE_TRUSTED";
        USER_OVERRIDE: "USER_OVERRIDE";
    }>;
    change: z.ZodObject<{
        evidence_links: z.ZodArray<z.ZodObject<{
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
        }, z.core.$strict>>;
        change_policy_used: z.ZodEnum<{
            LATEST_WINS: "LATEST_WINS";
            EVIDENCE_WEIGHTED: "EVIDENCE_WEIGHTED";
            SOURCE_TRUSTED: "SOURCE_TRUSTED";
            USER_OVERRIDE: "USER_OVERRIDE";
        }>;
        change_summary: z.ZodString;
        change_type: z.ZodEnum<{
            unknown: "unknown";
            added: "added";
            corrected: "corrected";
            inverted: "inverted";
            supplemented: "supplemented";
        }>;
    }, z.core.$strict>;
    risk: z.ZodObject<{
        evidence_links: z.ZodArray<z.ZodObject<{
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
        }, z.core.$strict>>;
        change_policy_used: z.ZodEnum<{
            LATEST_WINS: "LATEST_WINS";
            EVIDENCE_WEIGHTED: "EVIDENCE_WEIGHTED";
            SOURCE_TRUSTED: "SOURCE_TRUSTED";
            USER_OVERRIDE: "USER_OVERRIDE";
        }>;
        risk_summary: z.ZodString;
    }, z.core.$strict>;
    opportunity: z.ZodObject<{
        evidence_links: z.ZodArray<z.ZodObject<{
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
        }, z.core.$strict>>;
        change_policy_used: z.ZodEnum<{
            LATEST_WINS: "LATEST_WINS";
            EVIDENCE_WEIGHTED: "EVIDENCE_WEIGHTED";
            SOURCE_TRUSTED: "SOURCE_TRUSTED";
            USER_OVERRIDE: "USER_OVERRIDE";
        }>;
        opportunity_summary: z.ZodString;
    }, z.core.$strict>;
    disagreement: z.ZodObject<{
        evidence_links: z.ZodArray<z.ZodObject<{
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
        }, z.core.$strict>>;
        change_policy_used: z.ZodEnum<{
            LATEST_WINS: "LATEST_WINS";
            EVIDENCE_WEIGHTED: "EVIDENCE_WEIGHTED";
            SOURCE_TRUSTED: "SOURCE_TRUSTED";
            USER_OVERRIDE: "USER_OVERRIDE";
        }>;
        dispute_summary: z.ZodString;
        sides: z.ZodArray<z.ZodString>;
        coverage_gaps: z.ZodArray<z.ZodString>;
    }, z.core.$strict>;
}, z.core.$strict>;
export type DecisionSignals = z.infer<typeof DecisionSignalsSchema>;
//# sourceMappingURL=signals.d.ts.map