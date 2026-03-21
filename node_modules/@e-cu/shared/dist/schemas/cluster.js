"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClusterSchema = exports.ClusterKindSchema = void 0;
const zod_1 = require("zod");
const isoUtcString = zod_1.z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'invalid datetime' });
exports.ClusterKindSchema = zod_1.z.enum(['event_update', 'topic_drift']);
exports.ClusterSchema = zod_1.z
    .object({
    cluster_id: zod_1.z.string().min(1),
    representative_cluster_id: zod_1.z.string().min(1),
    created_at_utc: isoUtcString,
    canonical_signature: zod_1.z.string().min(1),
    cluster_kind: exports.ClusterKindSchema,
    clustering_model_version: zod_1.z.string().min(1),
    // Aliases/parents enable merge/split stability across rounds.
    cluster_aliases: zod_1.z.array(zod_1.z.string()).optional(),
    cluster_parents: zod_1.z.array(zod_1.z.string()).optional(),
    // Optional metadata for display / downstream scoring.
    topic_labels: zod_1.z.array(zod_1.z.string()).optional(),
    last_updated_at_utc: isoUtcString.optional(),
})
    .strict();
