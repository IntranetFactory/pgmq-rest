/// <reference lib="deno.ns" />
import assert from "node:assert/strict";
import { neon } from "@neondatabase/serverless";

const API_URL = Deno.env.get("API_URL") || "http://localhost:8080/api/v1";
const DATABASE_URL = Deno.env.get("DATABASE_URL") || "";

const uniqueName = (): string => `test_queue_${crypto.randomUUID().replace(/-/g, "")}`;

const apiRequest = async (endpoint: string, body: Record<string, unknown>, timeout = 5000): Promise<unknown> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`request failed ${endpoint}: ${response.status}\n${await response.text()}`);

    if (response.headers.get("Content-Length") === "0") return;
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
};

const createTestQueue = async (): Promise<string> => {
  const queueName = uniqueName();
  await apiRequest("/create", { queue_name: queueName });
  return queueName;
};

const dropTestQueue = async (queueName: string): Promise<void> => {
  await apiRequest("/drop_queue", { queue_name: queueName });
};

let setupDone = false;
const ensureSetup = async (): Promise<void> => {
  if (setupDone) return;
  const sql = neon(DATABASE_URL);
  await sql`DROP EXTENSION IF EXISTS pgmq`;
  await sql`CREATE EXTENSION IF NOT EXISTS pgmq`;
  setupDone = true;
};

Deno.test("pgmq-rest", async (t) => {
  await ensureSetup();

  await t.step("Queue Management", async (t) => {
    await t.step("Create and drop a queue", async () => {
      const queueName = uniqueName();

      await apiRequest("/create", { queue_name: queueName });

      const queues = (await apiRequest("/list_queues", {})) as unknown[][];

      const foundQueue = queues.find((q: unknown[]) => q[0] === queueName);
      assert.ok(foundQueue !== undefined, "Queue should be found after creation");
      assert.strictEqual(foundQueue![0], queueName);
      assert.strictEqual(foundQueue![1], false); // is_partitioned
      assert.strictEqual(foundQueue![2], false); // is_unlogged

      const dropResult = await apiRequest("/drop_queue", { queue_name: queueName });
      assert.strictEqual(dropResult, true);

      const queuesAfterDrop = (await apiRequest("/list_queues", {})) as unknown[][];
      const queueAfterDrop = queuesAfterDrop.find((q: unknown[]) => q[0] === queueName);
      assert.strictEqual(queueAfterDrop, undefined);
    });

    await t.step("Create unlogged queue", async () => {
      const queueName = uniqueName();

      await apiRequest("/create_unlogged", { queue_name: queueName });

      const queues = (await apiRequest("/list_queues", {})) as unknown[][];
      const foundQueue = queues.find((q: unknown[]) => q[0] === queueName);
      assert.ok(foundQueue !== undefined, "Unlogged queue should be found");
      assert.strictEqual(foundQueue![2], true); // is_unlogged

      await apiRequest("/drop_queue", { queue_name: queueName });
    });
  });

  await t.step("Sending Messages", async (t) => {
    await t.step("Send a message", async () => {
      const queueName = await createTestQueue();
      try {
        const testMessage = { test: "data", value: 123 };
        const msgIds = (await apiRequest("/send", { queue_name: queueName, msg: testMessage })) as number[];

        assert.ok(Array.isArray(msgIds));
        assert.strictEqual(msgIds.length, 1);
        assert.strictEqual(typeof msgIds[0], "number");
      } finally {
        await dropTestQueue(queueName);
      }
    });

    await t.step("Send a message with delay", async () => {
      const queueName = await createTestQueue();
      try {
        const testMessage = { test: "delayed" };
        const msgIds = (await apiRequest("/send", { queue_name: queueName, msg: testMessage, delay: 1 })) as number[];

        assert.ok(Array.isArray(msgIds));
        assert.strictEqual(msgIds.length, 1);
      } finally {
        await dropTestQueue(queueName);
      }
    });

    await t.step("Send batch messages", async () => {
      const queueName = await createTestQueue();
      try {
        const testMessages = [{ test: "batch1" }, { test: "batch2" }, { test: "batch3" }];
        const msgIds = (await apiRequest("/send_batch", { queue_name: queueName, msgs: testMessages })) as number[];

        assert.ok(Array.isArray(msgIds));
        assert.strictEqual(msgIds.length, 3);
      } finally {
        await dropTestQueue(queueName);
      }
    });
  });

  await t.step("Reading Messages", async (t) => {
    await t.step("Read messages", async () => {
      const queueName = await createTestQueue();
      try {
        const testMessage = { test: "read_test" };
        const msgIds = (await apiRequest("/send", { queue_name: queueName, msg: testMessage })) as number[];

        const messages = (await apiRequest("/read", { queue_name: queueName, vt: 30, qty: 5 })) as unknown[][];

        assert.ok(Array.isArray(messages));
        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0][0], msgIds[0]);
        assert.deepStrictEqual(messages[0][4], testMessage);
      } finally {
        await dropTestQueue(queueName);
      }
    });

    await t.step("Read messages with polling", async () => {
      const queueName = await createTestQueue();
      try {
        const testMessage = { test: "read_with_poll_test" };
        // Send message after a short delay to test polling
        setTimeout(async () => {
          await apiRequest("/send", { queue_name: queueName, msg: testMessage });
        }, 100);

        const messages = (await apiRequest("/read_with_poll", {
          queue_name: queueName,
          vt: 30,
          qty: 5,
          max_poll_seconds: 2,
          poll_interval_ms: 100,
        })) as unknown[][];

        assert.ok(Array.isArray(messages));
        assert.strictEqual(messages.length, 1);
        assert.deepStrictEqual(messages[0][4], testMessage);
      } finally {
        await dropTestQueue(queueName);
      }
    });

    await t.step("Pop message", async () => {
      const queueName = await createTestQueue();
      try {
        const testMessage = { test: "pop_test" };
        await apiRequest("/send", { queue_name: queueName, msg: testMessage });

        const messages = (await apiRequest("/pop", { queue_name: queueName })) as unknown[][];

        assert.ok(Array.isArray(messages));
        assert.strictEqual(messages.length, 1);
        assert.deepStrictEqual(messages[0][4], testMessage);
      } finally {
        await dropTestQueue(queueName);
      }
    });
  });

  await t.step("Deleting and Archiving Messages", async (t) => {
    await t.step("Delete a message", async () => {
      const queueName = await createTestQueue();
      try {
        const testMessage = { test: "delete_test" };
        const msgIds = (await apiRequest("/send", { queue_name: queueName, msg: testMessage })) as number[];

        const deleteResult = await apiRequest("/delete", { queue_name: queueName, msg_id: msgIds[0] });
        assert.strictEqual(deleteResult, true);

        const messages = (await apiRequest("/read", { queue_name: queueName, vt: 30, qty: 5 })) as unknown[][];
        assert.strictEqual(messages.length, 0);
      } finally {
        await dropTestQueue(queueName);
      }
    });

    await t.step("Delete batch messages", async () => {
      const queueName = await createTestQueue();
      try {
        const testMessages = [{ test: "batch_delete1" }, { test: "batch_delete2" }, { test: "batch_delete3" }];
        const msgIds = (await apiRequest("/send_batch", { queue_name: queueName, msgs: testMessages })) as number[];

        const deletedIds = (await apiRequest("/delete_batch", { queue_name: queueName, msg_ids: msgIds })) as number[];
        assert.ok(Array.isArray(deletedIds));
        assert.strictEqual(deletedIds.length, 3);

        const messages = (await apiRequest("/read", { queue_name: queueName, vt: 30, qty: 5 })) as unknown[][];
        assert.strictEqual(messages.length, 0);
      } finally {
        await dropTestQueue(queueName);
      }
    });

    await t.step("Purge queue", async () => {
      const queueName = await createTestQueue();
      try {
        const testMessages = [{ test: "purge1" }, { test: "purge2" }, { test: "purge3" }];
        await apiRequest("/send_batch", { queue_name: queueName, msgs: testMessages });

        const purgeCount = await apiRequest("/purge_queue", { queue_name: queueName });
        assert.strictEqual(purgeCount, 3);

        const messages = (await apiRequest("/read", { queue_name: queueName, vt: 30, qty: 5 })) as unknown[][];
        assert.strictEqual(messages.length, 0);
      } finally {
        await dropTestQueue(queueName);
      }
    });

    await t.step("Archive a message", async () => {
      const queueName = await createTestQueue();
      try {
        const testMessage = { test: "archive_test" };
        const msgIds = (await apiRequest("/send", { queue_name: queueName, msg: testMessage })) as number[];

        const archiveResult = await apiRequest("/archive", { queue_name: queueName, msg_id: msgIds[0] });
        assert.strictEqual(archiveResult, true);

        const messages = (await apiRequest("/read", { queue_name: queueName, vt: 30, qty: 5 })) as unknown[][];
        assert.strictEqual(messages.length, 0);
      } finally {
        await dropTestQueue(queueName);
      }
    });

    await t.step("Archive batch messages", async () => {
      const queueName = await createTestQueue();
      try {
        const testMessages = [{ test: "batch_archive1" }, { test: "batch_archive2" }, { test: "batch_archive3" }];
        const msgIds = (await apiRequest("/send_batch", { queue_name: queueName, msgs: testMessages })) as number[];

        const archivedIds = (await apiRequest("/archive_batch", { queue_name: queueName, msg_ids: msgIds })) as number[];
        assert.ok(Array.isArray(archivedIds));
        assert.strictEqual(archivedIds.length, 3);

        const messages = (await apiRequest("/read", { queue_name: queueName, vt: 30, qty: 5 })) as unknown[][];
        assert.strictEqual(messages.length, 0);
      } finally {
        await dropTestQueue(queueName);
      }
    });
  });

  await t.step("Utilities", async (t) => {
    await t.step("Set visibility timeout", async () => {
      const queueName = await createTestQueue();
      try {
        const testMessage = { test: "vt_test" };
        const msgIds = (await apiRequest("/send", { queue_name: queueName, msg: testMessage })) as number[];

        const initialMessages = (await apiRequest("/read", { queue_name: queueName, vt: 30, qty: 1 })) as unknown[][];
        const initialVt = initialMessages[0][3]; // vt

        const vtResult = (await apiRequest("/set_vt", { queue_name: queueName, msg_id: msgIds[0], vt_offset: 60 })) as unknown[][];
        assert.ok(Array.isArray(vtResult));
        assert.strictEqual(vtResult.length, 1);

        const newVt = vtResult[0][3];
        assert.notStrictEqual(newVt, initialVt);
      } finally {
        await dropTestQueue(queueName);
      }
    });

    await t.step("Get metrics for a queue", async () => {
      const queueName = await createTestQueue();
      try {
        await apiRequest("/send_batch", { queue_name: queueName, msgs: [{ test: 1 }, { test: 2 }, { test: 3 }] });

        const metrics = (await apiRequest("/metrics", { queue_name: queueName })) as unknown[][];
        assert.ok(Array.isArray(metrics));
        assert.strictEqual(metrics.length, 1);
        assert.strictEqual(metrics[0][0], queueName); // queue_name
        assert.strictEqual(metrics[0][1], 3); // queue_length
        assert.strictEqual(metrics[0][4], 3); // total_messages
      } finally {
        await dropTestQueue(queueName);
      }
    });

    await t.step("Get metrics for all queues", async () => {
      const queueName = await createTestQueue();
      try {
        await apiRequest("/send", { queue_name: queueName, msg: { test: "metrics_all" } });

        const allMetrics = (await apiRequest("/metrics_all", {})) as unknown[][];
        assert.ok(Array.isArray(allMetrics));

        const queueMetrics = allMetrics.find((m: unknown[]) => m[0] === queueName);
        assert.ok(queueMetrics !== undefined, "Queue metrics should exist");
        assert.strictEqual(queueMetrics![1], 1); // queue_length
      } finally {
        await dropTestQueue(queueName);
      }
    });
  });
});
