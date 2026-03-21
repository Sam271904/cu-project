import { z } from 'zod';
export declare const ClusterKindSchema: z.ZodEnum<{
    event_update: "event_update";
    topic_drift: "topic_drift";
}>;
export type ClusterKind = z.infer<typeof ClusterKindSchema>;
export declare const ClusterSchema: z.ZodObject<{
    cluster_id: z.ZodString;
    representative_cluster_id: z.ZodString;
    created_at_utc: z.ZodString;
    canonical_signature: z.ZodString;
    cluster_kind: z.ZodEnum<{
        event_update: "event_update";
        topic_drift: "topic_drift";
    }>;
    clustering_model_version: z.ZodString;
    cluster_aliases: z.ZodOptional<z.ZodArray<z.ZodString>>;
    cluster_parents: z.ZodOptional<z.ZodArray<z.ZodString>>;
    topic_labels: z.ZodOptional<z.ZodArray<z.ZodString>>;
    last_updated_at_utc: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export type Cluster = z.infer<typeof ClusterSchema>;
//# sourceMappingURL=cluster.d.ts.map