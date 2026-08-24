import assert from "node:assert/strict";
import test from "node:test";
import type { QueuePublisher } from "../src/infrai_queue.js";
import { routeGameEvent } from "../src/notification_fanout.js";

class RecordingQueue implements QueuePublisher {
  readonly messages: Array<{ queue: string; payload: unknown; key: string }> = [];

  async publish(queue: string, payload: unknown, key: string): Promise<void> {
    this.messages.push({ queue, payload, key });
  }
}

test("player assets go to one moderation review instead of subscriber fanout", async () => {
  const queue = new RecordingQueue();
  const result = await routeGameEvent(
    {
      eventId: "asset-event-9",
      kind: "player_asset_created",
      asset: {
        assetId: "banner-9",
        creatorPlayerId: "player-9",
        name: "Finals Banner",
      },
      subscribers: [
        { playerId: "player-1", channel: "push" },
        { playerId: "player-2", channel: "in_game" },
      ],
    },
    queue,
  );

  assert.deepEqual(result, {
    eventId: "asset-event-9",
    route: "moderation",
    published: 1,
  });
  assert.equal(queue.messages.length, 1);
  assert.equal(queue.messages[0]?.queue, "moderation-reviews");
  assert.equal(queue.messages[0]?.key, "moderation:asset-event-9");
  assert.deepEqual(queue.messages[0]?.payload, {
    type: "moderation_review_requested",
    event_id: "asset-event-9",
    asset: {
      assetId: "banner-9",
      creatorPlayerId: "player-9",
      name: "Finals Banner",
    },
  });
});
