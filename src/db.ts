import { Pool, PoolClient } from "pg";

export type DbEnv = {
  DB_HOST: string;
  DB_PORT: string;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_POOL_SIZE: string;
};

// Module-level singleton is safe in JavaScript's single-threaded event loop.
// In a Cloudflare Worker, the Worker isolate reuses this across requests for the same env.
let cachedPool: Pool | null = null;

const getPool = (env: DbEnv): Pool => {
  if (!cachedPool) {
    cachedPool = new Pool({
      host: env.DB_HOST,
      port: parseInt(env.DB_PORT, 10),
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      max: parseInt(env.DB_POOL_SIZE, 10),
    });
  }
  return cachedPool;
};

export const withClient = async <T>(env: DbEnv, fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const pool = getPool(env);
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
};
