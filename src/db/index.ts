import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Required format for Hetzner PgBouncer connections
const dbUrl = process.env.DATABASE_URL || "postgresql://jvp_user:V3l4p4r3d3s@localhost:6432/ogess";
const client = postgres(dbUrl, { prepare: false });

export const db = drizzle(client, { schema });
