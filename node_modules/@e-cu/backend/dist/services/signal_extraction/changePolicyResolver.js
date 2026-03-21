"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseChangePolicyEnvOverride = parseChangePolicyEnvOverride;
exports.resolveChangePolicyFromSourceTypes = resolveChangePolicyFromSourceTypes;
const shared_1 = require("@e-cu/shared");
/**
 * Task 6.2 Step 4: map truth policy `C` from env override + this round's evidence `source_type` set.
 *
 * Priority:
 * 1. `PIH_CHANGE_POLICY` (if valid enum) — global override for all clusters in the process.
 * 2. Any `bookmark` — user-curated inputs → USER_OVERRIDE.
 * 3. Only `tech` (no social/bookmark) — SOURCE_TRUSTED.
 * 4. Any `social` — noisy feeds → EVIDENCE_WEIGHTED.
 * 5. Default — LATEST_WINS.
 */
function parseChangePolicyEnvOverride(raw) {
    if (raw === undefined || raw === null)
        return null;
    const v = String(raw).trim();
    if (!v)
        return null;
    const parsed = shared_1.ChangePolicySchema.safeParse(v);
    return parsed.success ? parsed.data : null;
}
function resolveChangePolicyFromSourceTypes(sourceTypes, override) {
    if (override)
        return override;
    const set = new Set(sourceTypes.map((s) => String(s)));
    if (set.has('bookmark'))
        return 'USER_OVERRIDE';
    const onlyTech = set.size > 0 && [...set].every((t) => t === 'tech');
    if (onlyTech)
        return 'SOURCE_TRUSTED';
    if (set.has('social'))
        return 'EVIDENCE_WEIGHTED';
    return 'LATEST_WINS';
}
