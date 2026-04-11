import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema.js";
import { mkdirSync } from "fs";

mkdirSync("./data", { recursive: true });

const sqlite = new Database("./data/notes.db");
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");
sqlite.exec("PRAGMA synchronous = NORMAL;");
sqlite.exec("PRAGMA busy_timeout = 5000;");
sqlite.exec("PRAGMA cache_size = -64000;");

// Create indexes if they don't exist (idempotent)
sqlite.exec(`
  CREATE INDEX IF NOT EXISTS idx_pages_created_by_archived ON pages(created_by, archived_at);
  CREATE INDEX IF NOT EXISTS idx_pages_parent_page_id ON pages(parent_page_id);
  CREATE INDEX IF NOT EXISTS idx_blocks_page_id_type ON blocks(page_id, type);
  CREATE INDEX IF NOT EXISTS idx_database_rows_database_id ON database_rows(database_id);
  CREATE INDEX IF NOT EXISTS idx_database_cell_values_row_id ON database_cell_values(row_id);
  CREATE INDEX IF NOT EXISTS idx_database_cell_values_property_id ON database_cell_values(property_id);
  CREATE INDEX IF NOT EXISTS idx_database_properties_page_id ON database_properties(page_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_links_source_page_id ON links(source_page_id);
  CREATE INDEX IF NOT EXISTS idx_links_target_page_id ON links(target_page_id);
`);

// Cleanup expired sessions on startup
sqlite.exec(`DELETE FROM sessions WHERE expires_at < ${Date.now()}`);

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;
