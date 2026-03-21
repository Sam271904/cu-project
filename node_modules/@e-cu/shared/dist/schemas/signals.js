"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecisionSignalsSchema = exports.DisagreementSignalSchema = exports.OpportunitySignalSchema = exports.RiskSignalSchema = exports.ChangeSignalSchema = exports.ChangeTypeSchema = exports.ChangePolicySchema = void 0;
const zod_1 = require("zod");
const evidence_1 = require("./evidence");
exports.ChangePolicySchema = zod_1.z.enum([
    'LATEST_WINS',
    'EVIDENCE_WEIGHTED',
    'SOURCE_TRUSTED',
    'USER_OVERRIDE',
]);
exports.ChangeTypeSchema = zod_1.z.enum([
    'added',
    'corrected',
    'inverted',
    'supplemented',
    'unknown',
]);
const EvidenceLinksAndPolicySchema = zod_1.z
    .object({
    evidence_links: zod_1.z.array(evidence_1.EvidenceLinkSchema),
    change_policy_used: exports.ChangePolicySchema,
})
    .strict();
exports.ChangeSignalSchema = EvidenceLinksAndPolicySchema.extend({
    change_summary: zod_1.z.string(),
    change_type: exports.ChangeTypeSchema,
}).strict();
exports.RiskSignalSchema = EvidenceLinksAndPolicySchema.extend({
    risk_summary: zod_1.z.string(),
}).strict();
exports.OpportunitySignalSchema = EvidenceLinksAndPolicySchema.extend({
    opportunity_summary: zod_1.z.string(),
}).strict();
exports.DisagreementSignalSchema = EvidenceLinksAndPolicySchema.extend({
    dispute_summary: zod_1.z.string(),
    sides: zod_1.z.array(zod_1.z.string()),
    coverage_gaps: zod_1.z.array(zod_1.z.string()),
}).strict();
exports.DecisionSignalsSchema = zod_1.z
    .object({
    cluster_id: zod_1.z.string().min(1),
    signal_schema_version: zod_1.z.string().min(1),
    change_policy_used: exports.ChangePolicySchema,
    change: exports.ChangeSignalSchema,
    risk: exports.RiskSignalSchema,
    opportunity: exports.OpportunitySignalSchema,
    disagreement: exports.DisagreementSignalSchema,
})
    .strict()
    .superRefine((data, ctx) => {
    const policy = data.change_policy_used;
    const check = (key) => {
        if (data[key].change_policy_used !== policy) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: `change_policy_used mismatch at ${key}`,
                path: [key, 'change_policy_used'],
            });
        }
    };
    check('change');
    check('risk');
    check('opportunity');
    check('disagreement');
});
