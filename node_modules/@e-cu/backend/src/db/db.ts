import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { getCreateSchemaSql } from './schema';

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

  return db;
}

