export type ClaimEmbeddingClientConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

/** Parse JSON array of numbers from DB column; invalid → null */
export function parseEmbeddingJson(raw: string | null | undefined): number[] | null {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  try {
    const p = JSON.parse(String(raw)) as unknown;
    if (!Array.isArray(p) || p.length === 0) return null;
    const out: number[] = [];
    for (const x of p) {
      const n = Number(x);
      if (!Number.isFinite(n)) return null;
      out.push(n);
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * OpenAI-compatible `POST /v1/embeddings`.
 * `input` truncated to reduce payload size (spec: claim_text only, no snippets).
 */
export async function fetchClaimEmbeddingOpenAiCompatible(
  cfg: ClaimEmbeddingClientConfig,
  input: string,
): Promise<number[]> {
  const url = `${cfg.baseUrl.replace(/\/$/, '')}/embeddings`;
  const body = {
    model: cfg.model,
    input: input.slice(0, 8000),
  };

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
    throw new Error(`embedding_http_${res.status}: ${rawText.slice(0, 400)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch {
    throw new Error('embedding_response_not_json');
  }

  const emb = (parsed as { data?: Array<{ embedding?: number[] }> })?.data?.[0]?.embedding;
  if (!Array.isArray(emb) || emb.length === 0) {
    throw new Error('embedding_missing_data');
  }
  const out: number[] = [];
  for (const x of emb) {
    const n = Number(x);
    if (!Number.isFinite(n)) throw new Error('embedding_non_numeric');
    out.push(n);
  }
  return out;
}
