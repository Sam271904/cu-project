import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { getCreateSchemaSql } from './schema';

function migrateClusterTimelineState(db: Database.Database): void {
  const rows = db.prepare(`PRAGMA table_info(cluster_timeline_state)`).all() as Array<{ name: string }>;
  const names = new Set(rows.map((r) => r.name));
  if (!names.has('evidence_ref_ids_json')) {
    db.exec(`ALTER TABLE cluster_timeline_state ADD COLUMN evidence_ref_ids_json TEXT`);
  }
  if (!names.has('claim_text_hash')) {
    db.exec(`ALTER TABLE cluster_timeline_state ADD COLUMN claim_text_hash TEXT`);
  }
  if (!names.has('conflict_strength')) {
    db.exec(`ALTER TABLE cluster_timeline_state ADD COLUMN conflict_strength REAL`);
  }
}

export type DbOpenOptions = {
  databaseUrl?: string;
};

function resolveDatabasePath(databaseUrl?: string): string {
  const raw = databaseUrl ?? process.env.DATABASE_URL ?? '';

  // Allow `sqlite:` prefix (e.g. `sqlite:./data/app.db`).
  const normalized = raw.startsWith('sqlite:') ? raw.slice('sqlite:'.length) : raw;

  if (!normalized) {
    // Default to a persistent file in backend workspace.
    const defaultDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(defaultDir)) fs.mkdirSync(defaultDir, { recursive: true });
    return path.join(defaultDir, 'app.db');
  }

  return normalized;
}

export function openDb(options?: DbOpenOptions): Database.Database {
  const dbPath = resolveDatabasePath(options?.databaseUrl);
  const db = new Database(dbPath);

  const statements = getCreateSchemaSql();
  for (const sql of statements) {
    db.exec(sql);
  }

  migrateClusterTimelineState(db);

  return db;
}

