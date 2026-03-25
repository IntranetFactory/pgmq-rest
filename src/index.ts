import { swaggerUI } from "@hono/swagger-ui";
import { Hono } from "hono";

import { getSQL } from "./db.ts";
import type { Bindings, BooleanRow, IdRow, MessageRow, MetricRow, QueueRow } from "./types.ts";

const app = new Hono<{ Bindings: Bindings }>();

// --- DOCUMENTATION ---

app.get("/docs", swaggerUI({ url: "/openapi.json" }));

app.get("/openapi.json", (c) => {
  return c.json({
    openapi: "3.0.0",
    info: { title: "pgmq-rest documentation", version: "1.0.0" },
    paths: {
      "/api/v1/send": { post: { tags: ["Sending Messages"], summary: "Send a single message", requestBody: { content: { "application/json": { schema: { type: "object", required: ["queue_name", "msg"], properties: { queue_name: { type: "string" }, msg: {}, delay: { type: "integer" } } } } } }, responses: { "200": { description: "Array of message IDs" } } } },
      "/api/v1/send_batch": { post: { tags: ["Sending Messages"], summary: "Send multiple messages", requestBody: { content: { "application/json": { schema: { type: "object", required: ["queue_name", "msgs"], properties: { queue_name: { type: "string" }, msgs: { type: "array" }, delay: { type: "integer" } } } } } }, responses: { "200": { description: "Array of message IDs" } } } },
      "/api/v1/read": { post: { tags: ["Reading Messages"], summary: "Read messages from a queue", requestBody: { content: { "application/json": { schema: { type: "object", required: ["queue_name", "vt", "qty"], properties: { queue_name: { type: "string" }, vt: { type: "integer" }, qty: { type: "integer" }, conditional: {} } } } } }, responses: { "200": { description: "Array of message records" } } } },
      "/api/v1/read_with_poll": { post: { tags: ["Reading Messages"], summary: "Read messages with polling", requestBody: { content: { "application/json": { schema: { type: "object", required: ["queue_name", "vt", "qty"], properties: { queue_name: { type: "string" }, vt: { type: "integer" }, qty: { type: "integer" }, max_poll_seconds: { type: "integer" }, poll_interval_ms: { type: "integer" }, conditional: {} } } } } }, responses: { "200": { description: "Array of message records" } } } },
      "/api/v1/pop": { post: { tags: ["Reading Messages"], summary: "Pop a message from a queue", requestBody: { content: { "application/json": { schema: { type: "object", required: ["queue_name"], properties: { queue_name: { type: "string" } } } } } }, responses: { "200": { description: "Array of message records" } } } },
      "/api/v1/delete": { post: { tags: ["Deleting Messages"], summary: "Delete a message", requestBody: { content: { "application/json": { schema: { type: "object", required: ["queue_name", "msg_id"], properties: { queue_name: { type: "string" }, msg_id: { type: "number" } } } } } }, responses: { "200": { description: "Boolean result" } } } },
      "/api/v1/delete_batch": { post: { tags: ["Deleting Messages"], summary: "Delete multiple messages", requestBody: { content: { "application/json": { schema: { type: "object", required: ["queue_name", "msg_ids"], properties: { queue_name: { type: "string" }, msg_ids: { type: "array", items: { type: "number" } } } } } } }, responses: { "200": { description: "Array of deleted IDs" } } } },
      "/api/v1/purge_queue": { post: { tags: ["Deleting Messages"], summary: "Purge all messages from a queue", requestBody: { content: { "application/json": { schema: { type: "object", required: ["queue_name"], properties: { queue_name: { type: "string" } } } } } }, responses: { "200": { description: "Number of purged messages" } } } },
      "/api/v1/archive": { post: { tags: ["Deleting Messages"], summary: "Archive a message", requestBody: { content: { "application/json": { schema: { type: "object", required: ["queue_name", "msg_id"], properties: { queue_name: { type: "string" }, msg_id: { type: "number" } } } } } }, responses: { "200": { description: "Boolean result" } } } },
      "/api/v1/archive_batch": { post: { tags: ["Deleting Messages"], summary: "Archive multiple messages", requestBody: { content: { "application/json": { schema: { type: "object", required: ["queue_name", "msg_ids"], properties: { queue_name: { type: "string" }, msg_ids: { type: "array", items: { type: "number" } } } } } } }, responses: { "200": { description: "Array of archived IDs" } } } },
      "/api/v1/create": { post: { tags: ["Queue Management"], summary: "Create a queue", requestBody: { content: { "application/json": { schema: { type: "object", required: ["queue_name"], properties: { queue_name: { type: "string" } } } } } }, responses: { "200": { description: "void" } } } },
      "/api/v1/create_unlogged": { post: { tags: ["Queue Management"], summary: "Create an unlogged queue", requestBody: { content: { "application/json": { schema: { type: "object", required: ["queue_name"], properties: { queue_name: { type: "string" } } } } } }, responses: { "200": { description: "void" } } } },
      "/api/v1/drop_queue": { post: { tags: ["Queue Management"], summary: "Drop a queue", requestBody: { content: { "application/json": { schema: { type: "object", required: ["queue_name"], properties: { queue_name: { type: "string" } } } } } }, responses: { "200": { description: "Boolean result" } } } },
      "/api/v1/set_vt": { post: { tags: ["Utilities"], summary: "Set visibility timeout", requestBody: { content: { "application/json": { schema: { type: "object", required: ["queue_name", "msg_id", "vt_offset"], properties: { queue_name: { type: "string" }, msg_id: { type: "number" }, vt_offset: { type: "number" } } } } } }, responses: { "200": { description: "Array of message records" } } } },
      "/api/v1/list_queues": { post: { tags: ["Utilities"], summary: "List all queues", responses: { "200": { description: "Array of queue records" } } } },
      "/api/v1/metrics": { post: { tags: ["Utilities"], summary: "Get metrics for a queue", requestBody: { content: { "application/json": { schema: { type: "object", required: ["queue_name"], properties: { queue_name: { type: "string" } } } } } }, responses: { "200": { description: "Array of metric records" } } } },
      "/api/v1/metrics_all": { post: { tags: ["Utilities"], summary: "Get metrics for all queues", responses: { "200": { description: "Array of metric records" } } } },
    },
  });
});

app.get("/", (c) => c.redirect("/docs"));

// --- SENDING MESSAGES ---

// pgmq.send (queue_name text, msg jsonb, delay integer DEFAULT 0)
// RETURNS SETOF bigint

app.post("/api/v1/send", async (c) => {
  const sql = getSQL(c.env.DATABASE_URL);
  const { queue_name, msg, delay = 0 } = await c.req.json();
  const rows = (await sql.query("SELECT pgmq.send($1::text, $2::jsonb, $3::integer)", [queue_name, JSON.stringify(msg), delay])) as IdRow[];
  return c.json(rows.map(([id]) => Number(id)));
});

// pgmq.send_batch (queue_name text, msgs jsonb[], delay integer DEFAULT 0)
// RETURNS SETOF bigint

app.post("/api/v1/send_batch", async (c) => {
  const sql = getSQL(c.env.DATABASE_URL);
  const { queue_name, msgs, delay = 0 } = await c.req.json();
  const rows = (await sql.query("SELECT pgmq.send_batch($1::text, $2::jsonb[], $3::integer)", [
    queue_name,
    msgs.map((m: unknown) => JSON.stringify(m)),
    delay,
  ])) as IdRow[];
  return c.json(rows.map(([id]) => Number(id)));
});

// --- READING MESSAGES ---

// pgmq.read (queue_name text, vt integer, qty integer, conditional jsonb DEFAULT '{}')
// RETURNS SETOF pgmq.message_record

app.post("/api/v1/read", async (c) => {
  const sql = getSQL(c.env.DATABASE_URL);
  const { queue_name, vt, qty, conditional = {} } = await c.req.json();
  const rows = (await sql.query("SELECT * FROM pgmq.read($1::text, $2::integer, $3::integer, $4::jsonb)", [
    queue_name,
    vt,
    qty,
    JSON.stringify(conditional),
  ])) as MessageRow[];
  return c.json(rows.map((row) => [Number(row[0]), row[1], row[2], row[3], row[4], row[5]]));
});

// pgmq.read_with_poll (queue_name text, vt integer, qty integer, max_poll_seconds integer DEFAULT 5, poll_interval_ms integer DEFAULT 100, conditional jsonb DEFAULT '{}')
// RETURNS SETOF pgmq.message_record

app.post("/api/v1/read_with_poll", async (c) => {
  const sql = getSQL(c.env.DATABASE_URL);
  const { queue_name, vt, qty, max_poll_seconds = 5, poll_interval_ms = 100, conditional = {} } = await c.req.json();
  const rows = (await sql.query(
    "SELECT * FROM pgmq.read_with_poll($1::text, $2::integer, $3::integer, $4::integer, $5::integer, $6::jsonb)",
    [queue_name, vt, qty, max_poll_seconds, poll_interval_ms, JSON.stringify(conditional)],
  )) as MessageRow[];
  return c.json(rows.map((row) => [Number(row[0]), row[1], row[2], row[3], row[4], row[5]]));
});

// pgmq.pop (queue_name text)
// RETURNS SETOF pgmq.message_record

app.post("/api/v1/pop", async (c) => {
  const sql = getSQL(c.env.DATABASE_URL);
  const { queue_name } = await c.req.json();
  const rows = (await sql.query("SELECT * FROM pgmq.pop($1::text)", [queue_name])) as MessageRow[];
  return c.json(rows.map((row) => [Number(row[0]), row[1], row[2], row[3], row[4], row[5]]));
});

// --- DELETING/ARCHIVING MESSAGES ---

// pgmq.delete (queue_name text, msg_id: bigint)
// RETURNS boolean

app.post("/api/v1/delete", async (c) => {
  const sql = getSQL(c.env.DATABASE_URL);
  const { queue_name, msg_id } = await c.req.json();
  const rows = (await sql.query("SELECT pgmq.delete($1::text, $2::bigint)", [queue_name, msg_id])) as BooleanRow[];
  return c.json(rows[0]?.[0] ?? false);
});

// pgmq.delete (queue_name text, msg_ids: bigint[])
// RETURNS SETOF bigint

app.post("/api/v1/delete_batch", async (c) => {
  const sql = getSQL(c.env.DATABASE_URL);
  const { queue_name, msg_ids } = await c.req.json();
  const rows = (await sql.query("SELECT pgmq.delete($1::text, $2::bigint[])", [queue_name, msg_ids])) as IdRow[];
  return c.json(rows.map(([id]) => Number(id)));
});

// pgmq.purge_queue (queue_name text)
// RETURNS bigint

app.post("/api/v1/purge_queue", async (c) => {
  const sql = getSQL(c.env.DATABASE_URL);
  const { queue_name } = await c.req.json();
  const rows = (await sql.query("SELECT pgmq.purge_queue($1::text)", [queue_name])) as IdRow[];
  return c.json(rows[0]?.[0] ? Number(rows[0][0]) : 0);
});

// pgmq.archive (queue_name text, msg_id bigint)
// RETURNS boolean

app.post("/api/v1/archive", async (c) => {
  const sql = getSQL(c.env.DATABASE_URL);
  const { queue_name, msg_id } = await c.req.json();
  const rows = (await sql.query("SELECT pgmq.archive($1::text, $2::bigint)", [queue_name, msg_id])) as BooleanRow[];
  return c.json(rows[0]?.[0] ?? false);
});

// pgmq.archive (queue_name text, msg_ids bigint[])
// RETURNS SETOF bigint

app.post("/api/v1/archive_batch", async (c) => {
  const sql = getSQL(c.env.DATABASE_URL);
  const { queue_name, msg_ids } = await c.req.json();
  const rows = (await sql.query("SELECT pgmq.archive($1::text, $2::bigint[])", [queue_name, msg_ids])) as IdRow[];
  return c.json(rows.map(([id]) => Number(id)));
});

// --- QUEUE MANAGEMENT ---

// pgmq.create (queue_name text)
// RETURNS void

app.post("/api/v1/create", async (c) => {
  const sql = getSQL(c.env.DATABASE_URL);
  const { queue_name } = await c.req.json();
  await sql.query("SELECT pgmq.create($1::text)", [queue_name]);
  return c.body(null, 200);
});

// pgmq.create_unlogged (queue_name text)
// RETURNS void

app.post("/api/v1/create_unlogged", async (c) => {
  const sql = getSQL(c.env.DATABASE_URL);
  const { queue_name } = await c.req.json();
  await sql.query("SELECT pgmq.create_unlogged($1::text)", [queue_name]);
  return c.body(null, 200);
});

// pgmq.drop_queue (queue_name text)
// RETURNS boolean

app.post("/api/v1/drop_queue", async (c) => {
  const sql = getSQL(c.env.DATABASE_URL);
  const { queue_name } = await c.req.json();
  const rows = (await sql.query("SELECT pgmq.drop_queue($1::text)", [queue_name])) as BooleanRow[];
  return c.json(rows[0]?.[0] ?? false);
});

// --- UTILITIES ---

// pgmq.set_vt (queue_name text, msg_id bigint, vt_offset integer)
// RETURNS pgmq.message_record

app.post("/api/v1/set_vt", async (c) => {
  const sql = getSQL(c.env.DATABASE_URL);
  const { queue_name, msg_id, vt_offset } = await c.req.json();
  const rows = (await sql.query("SELECT * FROM pgmq.set_vt($1::text, $2::bigint, $3::integer)", [queue_name, msg_id, vt_offset])) as MessageRow[];
  return c.json(rows.map((row) => [Number(row[0]), row[1], row[2], row[3], row[4], row[5]]));
});

// pgmq.list_queues ()
// RETURNS TABLE(queue_name text, is_partitioned boolean, is_unlogged boolean, created_at timestamp with time zone)

app.post("/api/v1/list_queues", async (c) => {
  const sql = getSQL(c.env.DATABASE_URL);
  const rows = (await sql.query("SELECT * FROM pgmq.list_queues()")) as QueueRow[];
  return c.json(rows);
});

// pgmq.metrics (queue_name: text)
// RETURNS TABLE(queue_name text, queue_length bigint, newest_msg_age_sec integer, oldest_msg_age_sec integer, total_messages bigint, scrape_time timestamp with time zone)

app.post("/api/v1/metrics", async (c) => {
  const sql = getSQL(c.env.DATABASE_URL);
  const { queue_name } = await c.req.json();
  const rows = (await sql.query("SELECT * FROM pgmq.metrics($1::text)", [queue_name])) as MetricRow[];
  return c.json(rows.map((row) => [row[0], Number(row[1]), row[2], row[3], Number(row[4]), row[5]]));
});

// pgmq.metrics_all ()
// RETURNS TABLE(queue_name text, queue_length bigint, newest_msg_age_sec integer, oldest_msg_age_sec integer, total_messages bigint, scrape_time timestamp with time zone)

app.post("/api/v1/metrics_all", async (c) => {
  const sql = getSQL(c.env.DATABASE_URL);
  const rows = (await sql.query("SELECT * FROM pgmq.metrics_all()")) as MetricRow[];
  return c.json(rows.map((row) => [row[0], Number(row[1]), row[2], row[3], Number(row[4]), row[5]]));
});

export default app;
