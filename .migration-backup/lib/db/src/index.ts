import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// In serverless environments (Vercel) each function instance handles one request at a time,
// so max=1 is correct. Without this, 1000 concurrent players → 1000 instances each trying
// to hold 10 connections = 10,000 DB connections, which crashes any managed Postgres.
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: isServerless ? 1 : 10,
  idleTimeoutMillis: isServerless ? 1000 : 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
