import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Required format for Hetzner PgBouncer connections
const client = postgres(process.env.DATABASE_URL as string, { prepare: false });

export const db = drizzle(client, { schema });
