"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildClaimTextFromDecisionSignals = buildClaimTextFromDecisionSignals;
function buildClaimTextFromDecisionSignals(signals) {
    const sides = signals.disagreement.sides.map((s) => String(s));
    const gaps = signals.disagreement.coverage_gaps.map((s) => String(s));
    return [
        'CHANGE:',
        signals.change.change_summary,
        '||RISK:',
        signals.risk.risk_summary,
        '||OPP:',
        signals.opportunity.opportunity_summary,
        '||DISPUTE:',
        signals.disagreement.dispute_summary,
        '||SIDES:',
        sides.join(','),
        '||GAPS:',
        gaps.join(','),
    ].join('');
}
