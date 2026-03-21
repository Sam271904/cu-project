import { z } from 'zod';

const isoUtcString = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'invalid datetime' });

export const ClusterKindSchema = z.enum(['event_update', 'topic_drift']);

export type ClusterKind = z.infer<typeof ClusterKindSchema>;

export const ClusterSchema = z
  .object({
    cluster_id: z.string().min(1),
    representative_cluster_id: z.string().min(1),
    created_at_utc: isoUtcString,
    canonical_signature: z.string().min(1),
    cluster_kind: ClusterKindSchema,
    clustering_model_version: z.string().min(1),

    // Aliases/parents enable merge/split stability across rounds.
    cluster_aliases: z.array(z.string()).optional(),
    cluster_parents: z.array(z.string()).optional(),

    // Optional metadata for display / downstream scoring.
    topic_labels: z.array(z.string()).optional(),
    last_updated_at_utc: isoUtcString.optional(),
  })
  .strict();

export type Cluster = z.infer<typeof ClusterSchema>;

