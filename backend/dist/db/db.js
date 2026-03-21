"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openDb = openDb;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const schema_1 = require("./schema");
function resolveDatabasePath(databaseUrl) {
    const raw = databaseUrl ?? process.env.DATABASE_URL ?? '';
    // Allow `sqlite:` prefix (e.g. `sqlite:./data/app.db`).
    const normalized = raw.startsWith('sqlite:') ? raw.slice('sqlite:'.length) : raw;
    if (!normalized) {
        // Default to a persistent file in backend workspace.
        const defaultDir = node_path_1.default.join(process.cwd(), 'data');
        if (!node_fs_1.default.existsSync(defaultDir))
            node_fs_1.default.mkdirSync(defaultDir, { recursive: true });
        return node_path_1.default.join(defaultDir, 'app.db');
    }
    return normalized;
}
function openDb(options) {
    const dbPath = resolveDatabasePath(options?.databaseUrl);
    const db = new better_sqlite3_1.default(dbPath);
    const statements = (0, schema_1.getCreateSchemaSql)();
    for (const sql of statements) {
        db.exec(sql);
    }
    return db;
}
