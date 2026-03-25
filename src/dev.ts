/// <reference lib="deno.ns" />
import app from "./index.ts";

const port = parseInt(Deno.env.get("PORT") || "8080", 10);

Deno.serve({ port }, (req: Request) => {
  return app.fetch(req, { DATABASE_URL: Deno.env.get("DATABASE_URL") || "" });
});
