import { swaggerUI } from "@hono/swagger-ui";
import { Hono } from "hono";

import { DbEnv, withClient } from "./db.ts";
import { BooleanRecord, IdRecord, MessageRecord, MetricRecord, QueueRecord } from "./types.ts";

type Bindings = DbEnv;

const app = new Hono<{ Bindings: Bindings }>();

// Inject env vars from Deno environment when running locally (not as a CF Worker)
app.use("*", async (c, next) => {
  if (typeof Deno !== "undefined" && !c.env.DB_HOST) {
    const env = c.env as Record<string, string>;
    env["DB_HOST"] = Deno.env.get("DB_HOST") ?? "localhost";
    env["DB_PORT"] = Deno.env.get("DB_PORT") ?? "5432";
    env["DB_NAME"] = Deno.env.get("DB_NAME") ?? "postgres";
    env["DB_USER"] = Deno.env.get("DB_USER") ?? "postgres";
    env["DB_PASSWORD"] = Deno.env.get("DB_PASSWORD") ?? "postgres";
    env["DB_POOL_SIZE"] = Deno.env.get("DB_POOL_SIZE") ?? "20";
  }
  await next();
});

app.get("/", (c) => c.redirect("/docs"));

app.get("/docs", swaggerUI({ url: "/openapi.json" }));

app.get("/openapi.json", (c) =>
  c.json({
    openapi: "3.0.0",
    info: { title: "pgmq-rest documentation", version: "1.0.0" },
    paths: {
      "/api/v1/send": { post: { summary: "Send a message", tags: ["Sending Messages"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { queue_name: { type: "string" }, msg: {}, delay: { type: "integer" } }, required: ["queue_name", "msg"] } } } }, responses: { "200": { description: "Array of message IDs" } } } },
      "/api/v1/send_batch": { post: { summary: "Send multiple messages", tags: ["Sending Messages"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { queue_name: { type: "string" }, msgs: { type: "array" }, delay: { type: "integer" } }, required: ["queue_name", "msgs"] } } } }, responses: { "200": { description: "Array of message IDs" } } } },
      "/api/v1/read": { post: { summary: "Read messages from a queue", tags: ["Reading Messages"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { queue_name: { type: "string" }, vt: { type: "integer" }, qty: { type: "integer" }, conditional: {} }, required: ["queue_name", "vt", "qty"] } } } }, responses: { "200": { description: "Array of message records" } } } },
      "/api/v1/read_with_poll": { post: { summary: "Read messages with polling", tags: ["Reading Messages"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { queue_name: { type: "string" }, vt: { type: "integer" }, qty: { type: "integer" }, max_poll_seconds: { type: "integer" }, poll_interval_ms: { type: "integer" }, conditional: {} }, required: ["queue_name", "vt", "qty"] } } } }, responses: { "200": { description: "Array of message records" } } } },
      "/api/v1/pop": { post: { summary: "Pop a message", tags: ["Reading Messages"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { queue_name: { type: "string" } }, required: ["queue_name"] } } } }, responses: { "200": { description: "Array of message records" } } } },
      "/api/v1/delete": { post: { summary: "Delete a message", tags: ["Deleting Messages"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { queue_name: { type: "string" }, msg_id: { type: "number" } }, required: ["queue_name", "msg_id"] } } } }, responses: { "200": { description: "Boolean result" } } } },
      "/api/v1/delete_batch": { post: { summary: "Delete multiple messages", tags: ["Deleting Messages"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { queue_name: { type: "string" }, msg_ids: { type: "array", items: { type: "number" } } }, required: ["queue_name", "msg_ids"] } } } }, responses: { "200": { description: "Array of deleted message IDs" } } } },
      "/api/v1/purge_queue": { post: { summary: "Purge all messages from a queue", tags: ["Deleting Messages"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { queue_name: { type: "string" } }, required: ["queue_name"] } } } }, responses: { "200": { description: "Number of purged messages" } } } },
      "/api/v1/archive": { post: { summary: "Archive a message", tags: ["Deleting Messages"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { queue_name: { type: "string" }, msg_id: { type: "number" } }, required: ["queue_name", "msg_id"] } } } }, responses: { "200": { description: "Boolean result" } } } },
      "/api/v1/archive_batch": { post: { summary: "Archive multiple messages", tags: ["Deleting Messages"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { queue_name: { type: "string" }, msg_ids: { type: "array", items: { type: "number" } } }, required: ["queue_name", "msg_ids"] } } } }, responses: { "200": { description: "Array of archived message IDs" } } } },
      "/api/v1/create": { post: { summary: "Create a queue", tags: ["Queue Management"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { queue_name: { type: "string" } }, required: ["queue_name"] } } } }, responses: { "200": { description: "Success" } } } },
      "/api/v1/create_unlogged": { post: { summary: "Create an unlogged queue", tags: ["Queue Management"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { queue_name: { type: "string" } }, required: ["queue_name"] } } } }, responses: { "200": { description: "Success" } } } },
      "/api/v1/drop_queue": { post: { summary: "Drop a queue", tags: ["Queue Management"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { queue_name: { type: "string" } }, required: ["queue_name"] } } } }, responses: { "200": { description: "Boolean result" } } } },
      "/api/v1/set_vt": { post: { summary: "Set message visibility timeout", tags: ["Utilities"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { queue_name: { type: "string" }, msg_id: { type: "number" }, vt_offset: { type: "number" } }, required: ["queue_name", "msg_id", "vt_offset"] } } } }, responses: { "200": { description: "Updated message record" } } } },
      "/api/v1/list_queues": { post: { summary: "List all queues", tags: ["Utilities"], responses: { "200": { description: "Array of queue records" } } } },
      "/api/v1/metrics": { post: { summary: "Get metrics for a queue", tags: ["Utilities"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { queue_name: { type: "string" } }, required: ["queue_name"] } } } }, responses: { "200": { description: "Array of metric records" } } } },
      "/api/v1/metrics_all": { post: { summary: "Get metrics for all queues", tags: ["Utilities"], responses: { "200": { description: "Array of metric records" } } } },
    },
  }),
);

// --- SENDING MESSAGES ---

// pgmq.send (queue_name text, msg jsonb, delay integer DEFAULT 0)
// RETURNS SETOF bigint

app.post("/api/v1/send", async (c) => {
  const { queue_name, msg, delay = 0 } = await c.req.json<{ queue_name: string; msg: unknown; delay?: number }>();
  const result = await withClient(c.env, async (client) => {
    const r = await client.query<IdRecord>(
      { rowMode: "array", text: "SELECT pgmq.send($1::text, $2::jsonb, $3::integer)", name: "send" },
      [queue_name, msg, delay],
    );
    return r.rows.map(([id]: IdRecord) => Number(id));
  });
  return c.json(result);
});

// pgmq.send_batch (queue_name text, msgs jsonb[], delay integer DEFAULT 0)
// RETURNS SETOF bigint

app.post("/api/v1/send_batch", async (c) => {
  const { queue_name, msgs, delay = 0 } = await c.req.json<{ queue_name: string; msgs: unknown[]; delay?: number }>();
  const result = await withClient(c.env, async (client) => {
    const r = await client.query<IdRecord>(
      { rowMode: "array", text: "SELECT pgmq.send_batch($1::text, $2::jsonb[], $3::integer)", name: "send_batch" },
      [queue_name, msgs, delay],
    );
    return r.rows.map(([id]: IdRecord) => Number(id));
  });
  return c.json(result);
});

// --- READING MESSAGES ---

// pgmq.read (queue_name text, vt integer, qty integer, conditional jsonb DEFAULT '{}')
// RETURNS SETOF pgmq.message_record

app.post("/api/v1/read", async (c) => {
  const { queue_name, vt, qty, conditional = {} } = await c.req.json<{
    queue_name: string;
    vt: number;
    qty: number;
    conditional?: unknown;
  }>();
  const result = await withClient(c.env, async (client) => {
    const r = await client.query<MessageRecord>(
      { rowMode: "array", text: "SELECT * FROM pgmq.read($1::text, $2::integer, $3::integer, $4::jsonb)", name: "read" },
      [queue_name, vt, qty, conditional],
    );
    return r.rows.map((row: MessageRecord) => [Number(row[0]), row[1], row[2], row[3], row[4], row[5]]);
  });
  return c.json(result);
});

// pgmq.read_with_poll (queue_name text, vt integer, qty integer, max_poll_seconds integer DEFAULT 5, poll_interval_ms integer DEFAULT 100, conditional jsonb DEFAULT '{}')
// RETURNS SETOF pgmq.message_record

app.post("/api/v1/read_with_poll", async (c) => {
  const { queue_name, vt, qty, max_poll_seconds = 5, poll_interval_ms = 100, conditional = {} } = await c.req.json<{
    queue_name: string;
    vt: number;
    qty: number;
    max_poll_seconds?: number;
    poll_interval_ms?: number;
    conditional?: unknown;
  }>();
  const result = await withClient(c.env, async (client) => {
    const r = await client.query<MessageRecord>(
      {
        rowMode: "array",
        text: "SELECT * FROM pgmq.read_with_poll($1::text, $2::integer, $3::integer, $4::integer, $5::integer, $6::jsonb)",
        name: "read_with_poll",
      },
      [queue_name, vt, qty, max_poll_seconds, poll_interval_ms, conditional],
    );
    return r.rows.map((row: MessageRecord) => [Number(row[0]), row[1], row[2], row[3], row[4], row[5]]);
  });
  return c.json(result);
});

// pgmq.pop (queue_name text)
// RETURNS SETOF pgmq.message_record

app.post("/api/v1/pop", async (c) => {
  const { queue_name } = await c.req.json<{ queue_name: string }>();
  const result = await withClient(c.env, async (client) => {
    const r = await client.query<MessageRecord>({ rowMode: "array", text: "SELECT * FROM pgmq.pop($1::text)", name: "pop" }, [queue_name]);
    return r.rows.map((row: MessageRecord) => [Number(row[0]), row[1], row[2], row[3], row[4], row[5]]);
  });
  return c.json(result);
});

// --- DELETING/ARCHIVING MESSAGES ---

// pgmq.delete (queue_name text, msg_id: bigint)
// RETURNS boolean

app.post("/api/v1/delete", async (c) => {
  const { queue_name, msg_id } = await c.req.json<{ queue_name: string; msg_id: number }>();
  const result = await withClient(c.env, async (client) => {
    const r = await client.query<BooleanRecord>(
      { rowMode: "array", text: "SELECT pgmq.delete($1::text, $2::bigint)", name: "delete" },
      [queue_name, msg_id],
    );
    return r.rows[0]?.[0] ?? false;
  });
  return c.json(result);
});

// pgmq.delete (queue_name text, msg_ids: bigint[])
// RETURNS SETOF bigint

app.post("/api/v1/delete_batch", async (c) => {
  const { queue_name, msg_ids } = await c.req.json<{ queue_name: string; msg_ids: number[] }>();
  const result = await withClient(c.env, async (client) => {
    const r = await client.query<IdRecord>(
      { rowMode: "array", text: "SELECT pgmq.delete($1::text, $2::bigint[])", name: "delete_batch" },
      [queue_name, msg_ids],
    );
    return r.rows.map(([id]: IdRecord) => Number(id));
  });
  return c.json(result);
});

// purge_queue (queue_name text)
// RETURNS bigint

app.post("/api/v1/purge_queue", async (c) => {
  const { queue_name } = await c.req.json<{ queue_name: string }>();
  const result = await withClient(c.env, async (client) => {
    const r = await client.query<IdRecord>(
      { rowMode: "array", text: "SELECT pgmq.purge_queue($1::text)", name: "purge_queue" },
      [queue_name],
    );
    return r.rows[0]?.[0] ? Number(r.rows[0][0]) : 0;
  });
  return c.json(result);
});

// pgmq.archive (queue_name text, msg_id bigint)
// RETURNS boolean

app.post("/api/v1/archive", async (c) => {
  const { queue_name, msg_id } = await c.req.json<{ queue_name: string; msg_id: number }>();
  const result = await withClient(c.env, async (client) => {
    const r = await client.query<BooleanRecord>(
      { rowMode: "array", text: "SELECT pgmq.archive($1::text, $2::bigint)", name: "archive" },
      [queue_name, msg_id],
    );
    return r.rows[0]?.[0] ?? false;
  });
  return c.json(result);
});

// pgmq.archive (queue_name text, msg_ids bigint[])
// RETURNS SETOF bigint

app.post("/api/v1/archive_batch", async (c) => {
  const { queue_name, msg_ids } = await c.req.json<{ queue_name: string; msg_ids: number[] }>();
  const result = await withClient(c.env, async (client) => {
    const r = await client.query<IdRecord>(
      { rowMode: "array", text: "SELECT pgmq.archive($1::text, $2::bigint[])", name: "archive_batch" },
      [queue_name, msg_ids],
    );
    return r.rows.map(([id]: IdRecord) => Number(id));
  });
  return c.json(result);
});

// --- QUEUE MANAGEMENT ---

// pgmq.create (queue_name text)
// RETURNS void

app.post("/api/v1/create", async (c) => {
  const { queue_name } = await c.req.json<{ queue_name: string }>();
  await withClient(c.env, async (client) => {
    await client.query({ rowMode: "array", text: "SELECT pgmq.create($1::text)", name: "create" }, [queue_name]);
  });
  return c.json(null);
});

// pgmq.create_unlogged (queue_name text)
// RETURNS void

app.post("/api/v1/create_unlogged", async (c) => {
  const { queue_name } = await c.req.json<{ queue_name: string }>();
  await withClient(c.env, async (client) => {
    await client.query({ rowMode: "array", text: "SELECT pgmq.create_unlogged($1::text)", name: "create_unlogged" }, [queue_name]);
  });
  return c.json(null);
});

// pgmq.drop_queue (queue_name text)
// RETURNS boolean

app.post("/api/v1/drop_queue", async (c) => {
  const { queue_name } = await c.req.json<{ queue_name: string }>();
  const result = await withClient(c.env, async (client) => {
    const r = await client.query<BooleanRecord>(
      { rowMode: "array", text: "SELECT pgmq.drop_queue($1::text)", name: "drop_queue" },
      [queue_name],
    );
    return r.rows[0]?.[0] ?? false;
  });
  return c.json(result);
});

// --- UTILITIES ---

// pgmq.set_vt (queue_name text, msg_id bigint, vt_offset integer)
// RETURNS pgmq.message_record

app.post("/api/v1/set_vt", async (c) => {
  const { queue_name, msg_id, vt_offset } = await c.req.json<{ queue_name: string; msg_id: number; vt_offset: number }>();
  const result = await withClient(c.env, async (client) => {
    const r = await client.query<MessageRecord>(
      { rowMode: "array", text: "SELECT * FROM pgmq.set_vt($1::text, $2::bigint, $3::integer)", name: "set_vt" },
      [queue_name, msg_id, vt_offset],
    );
    return r.rows.map((row: MessageRecord) => [Number(row[0]), row[1], row[2], row[3], row[4], row[5]]);
  });
  return c.json(result);
});

// pgmq.list_queues ()
// RETURNS TABLE(queue_name text, is_partitioned boolean, is_unlogged boolean, created_at timestamp with time zone)

app.post("/api/v1/list_queues", async (c) => {
  const result = await withClient(c.env, async (client) => {
    const r = await client.query<QueueRecord>({ rowMode: "array", text: "SELECT * FROM pgmq.list_queues()", name: "list_queues" });
    return r.rows;
  });
  return c.json(result);
});

// pgmq.metrics (queue_name: text)
// RETURNS TABLE(queue_name text, queue_length bigint, newest_msg_age_sec integer, oldest_msg_age_sec integer, total_messages bigint, scrape_time timestamp with time zone)

app.post("/api/v1/metrics", async (c) => {
  const { queue_name } = await c.req.json<{ queue_name: string }>();
  const result = await withClient(c.env, async (client) => {
    const r = await client.query<MetricRecord>(
      { rowMode: "array", text: "SELECT * FROM pgmq.metrics($1::text)", name: "metrics" },
      [queue_name],
    );
    return r.rows.map((row: MetricRecord) => [row[0], Number(row[1]), row[2], row[3], Number(row[4]), row[5]]);
  });
  return c.json(result);
});

// pgmq.metrics_all ()
// RETURNS TABLE(queue_name text, queue_length bigint, newest_msg_age_sec integer, oldest_msg_age_sec integer, total_messages bigint, scrape_time timestamp with time zone)

app.post("/api/v1/metrics_all", async (c) => {
  const result = await withClient(c.env, async (client) => {
    const r = await client.query<MetricRecord>({ rowMode: "array", text: "SELECT * FROM pgmq.metrics_all()", name: "metrics_all" });
    return r.rows.map((row: MetricRecord) => [row[0], Number(row[1]), row[2], row[3], Number(row[4]), row[5]]);
  });
  return c.json(result);
});

// Cloudflare Worker export — also starts a local Deno server for development
export default app;

if (typeof Deno !== "undefined") {
  const port = 8080;
  console.log(`Server running at http://localhost:${port}`);
  Deno.serve({ port }, app.fetch);
}
