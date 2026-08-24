import assert from "node:assert/strict";
import test from "node:test";
import { InfraiQueue } from "../src/infrai_queue.js";

test("publish sends the required queue and payload fields", async () => {
  let request: RequestInit | undefined;
  const fetcher: typeof fetch = async (_input, init) => {
    request = init;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const queue = new InfraiQueue("test-key", fetcher);
  await queue.publish("subscriber-notifications", { event_id: "event-12" }, "key-12");

  assert.deepEqual(JSON.parse(String(request?.body)), {
    queue: "subscriber-notifications",
    payload: { event_id: "event-12" },
  });
});
