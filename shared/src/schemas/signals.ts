import { z } from 'zod';
import { EvidenceLinkSchema } from './evidence';

export const ChangePolicySchema = z.enum([
  'LATEST_WINS',
  'EVIDENCE_WEIGHTED',
  'SOURCE_TRUSTED',
  'USER_OVERRIDE',
]);

export type ChangePolicy = z.infer<typeof ChangePolicySchema>;

export const ChangeTypeSchema = z.enum([
  'added',
  'corrected',
  'inverted',
  'supplemented',
  'unknown',
]);

export type ChangeType = z.infer<typeof ChangeTypeSchema>;

const EvidenceLinksAndPolicySchema = z
  .object({
    evidence_links: z.array(EvidenceLinkSchema),
    change_policy_used: ChangePolicySchema,
  })
  .strict();

export const ChangeSignalSchema = EvidenceLinksAndPolicySchema.extend({
  change_summary: z.string(),
  change_type: ChangeTypeSchema,
}).strict();

export type ChangeSignal = z.infer<typeof ChangeSignalSchema>;

export const RiskSignalSchema = EvidenceLinksAndPolicySchema.extend({
  risk_summary: z.string(),
}).strict();

export type RiskSignal = z.infer<typeof RiskSignalSchema>;

export const OpportunitySignalSchema = EvidenceLinksAndPolicySchema.extend({
  opportunity_summary: z.string(),
}).strict();

export type OpportunitySignal = z.infer<typeof OpportunitySignalSchema>;

export const DisagreementSignalSchema = EvidenceLinksAndPolicySchema.extend({
  dispute_summary: z.string(),
  sides: z.array(z.string()),
  coverage_gaps: z.array(z.string()),
}).strict();

export type DisagreementSignal = z.infer<typeof DisagreementSignalSchema>;

export const DecisionSignalsSchema = z
  .object({
    cluster_id: z.string().min(1),
    signal_schema_version: z.string().min(1),
    change_policy_used: ChangePolicySchema,
    change: ChangeSignalSchema,
    risk: RiskSignalSchema,
    opportunity: OpportunitySignalSchema,
    disagreement: DisagreementSignalSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    const policy = data.change_policy_used;

    const check = (key: 'change' | 'risk' | 'opportunity' | 'disagreement') => {
      if (data[key].change_policy_used !== policy) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
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

export type DecisionSignals = z.infer<typeof DecisionSignalsSchema>;

