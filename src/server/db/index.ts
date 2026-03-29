import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema';

// Idiomatic Bun SQLite initialization
const sqlite = new Database('src/server/sqlite.db');
sqlite.exec('PRAGMA foreign_keys = ON;');

const usersColumns = sqlite.query('PRAGMA table_info(users)').all() as Array<{ name: string }>;
if (!usersColumns.some(column => column.name === 'is_player_character')) {
	sqlite.exec('ALTER TABLE users ADD COLUMN is_player_character INTEGER NOT NULL DEFAULT 0;');
}

// Most idiomatic pattern for Bun + Drizzle 0.31+
// Ensuring we're passing the sqlite database directly
export const db = drizzle(sqlite, { schema });
