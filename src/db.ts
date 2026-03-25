import { neon } from "@neondatabase/serverless";
import type { NeonQueryFunction } from "@neondatabase/serverless";

export type SQL = NeonQueryFunction<true, false>;

export const getSQL = (databaseUrl: string): SQL => {
  return neon(databaseUrl, { arrayMode: true, fullResults: false }) as SQL;
};
