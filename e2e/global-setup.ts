import fs from 'node:fs';
import path from 'node:path';

/**
 * Fresh SQLite DB for each `playwright test` run so acceptance tests are deterministic.
 */
export default async function globalSetup(): Promise<void> {
  const dbPath = path.resolve(__dirname, '..', 'backend', 'data', 'e2e-playwright.db');
  try {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  } catch {
    // ignore — server may recreate; unlink best-effort
  }
}
