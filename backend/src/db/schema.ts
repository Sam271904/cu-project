export function getCreateSchemaSql() {
  // v1 minimal schema required by Task 2/3 endpoints.
  return [
    `
    CREATE TABLE IF NOT EXISTS collection_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      status TEXT NOT NULL,
      pipeline_version TEXT NOT NULL
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS notification_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      endpoint TEXT NOT NULL UNIQUE,
      subscription_json TEXT NOT NULL,
      push_permission_status TEXT NOT NULL DEFAULT 'unknown',
      consent_timestamp TEXT
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS notification_event_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      user_id TEXT NOT NULL,
      event_key TEXT NOT NULL,
      reminder_level TEXT NOT NULL,
      signal_fingerprint TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued'
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS raw_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_round_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      source_name TEXT NOT NULL,
      external_id TEXT NOT NULL,
      title TEXT NOT NULL,
      published_at TEXT,
      collected_at TEXT NOT NULL,
      url TEXT NOT NULL,
      excerpt_or_summary TEXT,
      author TEXT,
      language TEXT NOT NULL,
      timestamp_quality TEXT NOT NULL,
      FOREIGN KEY(collection_round_id) REFERENCES collection_rounds(id)
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS normalized_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_round_id INTEGER NOT NULL,
      raw_item_id INTEGER NOT NULL,
      extractor_version TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      external_id TEXT NOT NULL,
      title TEXT NOT NULL,
      published_at TEXT,
      url TEXT NOT NULL,
      author TEXT,
      language TEXT NOT NULL,
      timestamp_quality TEXT NOT NULL,
      content_text_or_excerpt TEXT NOT NULL,
      content_summary TEXT NOT NULL,
      created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(raw_item_id),
      FOREIGN KEY(collection_round_id) REFERENCES collection_rounds(id),
      FOREIGN KEY(raw_item_id) REFERENCES raw_items(id)
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS clusters (
      cluster_id TEXT PRIMARY KEY,
      representative_cluster_id TEXT NOT NULL,
      created_at_utc TEXT NOT NULL,
      canonical_signature TEXT NOT NULL,
      cluster_kind TEXT NOT NULL DEFAULT 'topic_drift',
      clustering_model_version TEXT NOT NULL
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS cluster_evidence (
      cluster_id TEXT NOT NULL,
      normalized_item_id INTEGER NOT NULL,
      PRIMARY KEY(cluster_id, normalized_item_id),
      FOREIGN KEY (cluster_id) REFERENCES clusters(cluster_id),
      FOREIGN KEY (normalized_item_id) REFERENCES normalized_items(id)
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS cluster_parents (
      child_cluster_id TEXT PRIMARY KEY,
      parent_cluster_id TEXT NOT NULL,
      created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (child_cluster_id) REFERENCES clusters(cluster_id),
      FOREIGN KEY (parent_cluster_id) REFERENCES clusters(cluster_id)
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS cluster_split_state (
      root_cluster_id TEXT PRIMARY KEY,
      low_overlap_streak INTEGER NOT NULL DEFAULT 0,
      last_round_id INTEGER,
      FOREIGN KEY (root_cluster_id) REFERENCES clusters(cluster_id)
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS decision_signals (
      cluster_id TEXT PRIMARY KEY,
      created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      signal_schema_version TEXT NOT NULL,
      change_policy_used TEXT NOT NULL,
      signals_json TEXT NOT NULL,
      FOREIGN KEY (cluster_id) REFERENCES clusters(cluster_id)
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS knowledge_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cluster_id TEXT NOT NULL UNIQUE,
      created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      content_summary TEXT NOT NULL,
      snippet_text TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      entry_json TEXT NOT NULL,
      FOREIGN KEY (cluster_id) REFERENCES clusters(cluster_id)
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS cluster_timeline_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_round_id INTEGER NOT NULL,
      cluster_id TEXT NOT NULL,
      evidence_set_hash TEXT NOT NULL,
      cluster_kind TEXT NOT NULL,
      evidence_ref_ids_json TEXT,
      claim_text_hash TEXT,
      conflict_strength REAL,
      created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(collection_round_id, cluster_id),
      FOREIGN KEY (cluster_id) REFERENCES clusters(cluster_id),
      FOREIGN KEY (collection_round_id) REFERENCES collection_rounds(id)
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS rss_feed_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL CHECK (source_type IN ('social', 'tech')),
      feed_url TEXT NOT NULL UNIQUE,
      source_id TEXT,
      source_name TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS personalization_keyword_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mode TEXT NOT NULL CHECK (mode IN ('allow', 'deny')),
      keyword TEXT NOT NULL,
      created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(mode, keyword)
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS personalization_personas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      keywords_json TEXT NOT NULL,
      weight REAL NOT NULL DEFAULT 1.0,
      created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    `.trim(),
    `
    CREATE TABLE IF NOT EXISTS personalization_feedback (
      cluster_id TEXT NOT NULL PRIMARY KEY,
      sentiment INTEGER NOT NULL DEFAULT 0,
      saved INTEGER NOT NULL DEFAULT 0,
      updated_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    `.trim(),
  ];
}

