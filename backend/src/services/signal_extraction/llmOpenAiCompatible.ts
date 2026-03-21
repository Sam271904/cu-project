import { z } from 'zod';

import type { DecisionSignalsPayload } from './decisionSignalsBuilder';

const ChangeTypeEnum = z.enum(['added', 'corrected', 'inverted', 'supplemented', 'unknown']);

/** JSON object returned by the LLM — text fields only; evidence comes from our pipeline. */
const LlmSummariesOnlySchema = z
  .object({
    change_summary: z.string(),
    change_type: ChangeTypeEnum,
    risk_summary: z.string(),
    opportunity_summary: z.string(),
    dispute_summary: z.string(),
    sides: z.array(z.string()).min(1),
    coverage_gaps: z.array(z.string()),
  })
  .strict();

export type LlmSummariesOnly = z.infer<typeof LlmSummariesOnlySchema>;

export type LlmClientConfig = {
  apiKey: string;
  /** e.g. https://api.openai.com/v1 — no trailing slash */
  baseUrl: string;
  model: string;
  /** Some proxies do not support OpenAI `response_format`; set false to omit. */
  useJsonObjectResponseFormat: boolean;
};

function stripCodeFences(raw: string): string {
  const t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (fence) return fence[1].trim();
  return t;
}

export function mergeLlmSummariesIntoDecisionSignals(
  base: DecisionSignalsPayload,
  llm: LlmSummariesOnly,
): DecisionSignalsPayload {
  const policy = base.change_policy_used;
  return {
    ...base,
    change: {
      ...base.change,
      change_policy_used: policy,
      change_summary: llm.change_summary,
      change_type: llm.change_type,
    },
    risk: {
      ...base.risk,
      change_policy_used: policy,
      risk_summary: llm.risk_summary,
    },
    opportunity: {
      ...base.opportunity,
      change_policy_used: policy,
      opportunity_summary: llm.opportunity_summary,
    },
    disagreement: {
      ...base.disagreement,
      change_policy_used: policy,
      dispute_summary: llm.dispute_summary,
      sides: llm.sides,
      coverage_gaps: llm.coverage_gaps,
    },
  };
}

export function buildUserPrompt(opts: {
  uiLang: 'zh' | 'en';
  clusterLabel: string;
  changePolicy: string;
  evidenceBullets: string[];
}): string {
  const { uiLang, clusterLabel, changePolicy, evidenceBullets } = opts;
  const bullets = evidenceBullets.map((b, i) => `${i + 1}. ${b}`).join('\n');
  if (uiLang === 'zh') {
    return `你是信息聚合助手。下面是一组指向同一主题簇的证据摘录（可能重复或片面）。请基于这些摘录输出结构化决策信号摘要（不要编造 URL 或日期；不要引用原文大段复制）。

簇主题（摘要标签）：${clusterLabel}
本轮使用的变更策略枚举值（须原样出现在 JSON 中各段的 change_policy_used 由系统处理，你只需输出摘要字段）：${changePolicy}

证据摘录：
${bullets}

只输出一个 JSON 对象（不要 markdown），键为：
change_summary, change_type, risk_summary, opportunity_summary, dispute_summary, sides, coverage_gaps

要求：
- change_type 必须是 added | corrected | inverted | supplemented | unknown 之一
- sides 为字符串数组，至少 1 条
- coverage_gaps 为字符串数组（可为空数组）
- 各 summary 为简短中文句子`;
  }
  return `You aggregate evidence about one topical cluster. Using ONLY the excerpts below, output decision-signal summaries. Do not invent URLs or dates.

Cluster label: ${clusterLabel}
Change policy hint (for context only): ${changePolicy}

Evidence excerpts:
${bullets}

Return a single JSON object (no markdown) with keys:
change_summary, change_type, risk_summary, opportunity_summary, dispute_summary, sides, coverage_gaps

Rules:
- change_type must be one of: added | corrected | inverted | supplemented | unknown
- sides: string array, at least 1 item
- coverage_gaps: string array (may be empty)
- Summaries: concise English`;
}

export async function fetchLlmSummariesOpenAiCompatible(
  cfg: LlmClientConfig,
  userPrompt: string,
): Promise<LlmSummariesOnly> {
  const url = `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages: [
      {
        role: 'system',
        content:
          'You output only valid JSON objects matching the user schema. No prose before or after.',
      },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
  };
  if (cfg.useJsonObjectResponseFormat) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`llm_http_${res.status}: ${rawText.slice(0, 500)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch {
    throw new Error('llm_response_not_json');
  }

  const content = (parsed as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message
    ?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('llm_empty_content');
  }

  const jsonText = stripCodeFences(content);
  let obj: unknown;
  try {
    obj = JSON.parse(jsonText) as unknown;
  } catch {
    throw new Error('llm_content_not_json');
  }

  const validated = LlmSummariesOnlySchema.safeParse(obj);
  if (!validated.success) {
    throw new Error(`llm_schema_mismatch: ${validated.error.message}`);
  }
  return validated.data;
}
