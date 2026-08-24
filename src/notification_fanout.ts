import { z } from "zod";
import type { QueuePublisher } from "./infrai_queue.js";

const subscriberSchema = z.object({
  playerId: z.string().min(1),
  channel: z.enum(["in_game", "push"]),
});

const assetEventSchema = z.object({
  eventId: z.string().min(1),
  kind: z.literal("player_asset_created"),
  asset: z.object({
    assetId: z.string().min(1),
    creatorPlayerId: z.string().min(1),
    name: z.string().min(1).max(80),
  }),
  subscribers: z.array(subscriberSchema).max(500),
});

const liveEventSchema = z.object({
  eventId: z.string().min(1),
  kind: z.literal("live_event_started"),
  liveEvent: z.object({
    liveEventId: z.string().min(1),
    title: z.string().min(1).max(120),
  }),
  subscribers: z.array(subscriberSchema).min(1).max(500),
});

export const gameEventSchema = z.discriminatedUnion("kind", [
  assetEventSchema,
  liveEventSchema,
]);

export type GameEvent = z.infer<typeof gameEventSchema>;

export type FanoutResult = {
  eventId: string;
  route: "moderation" | "subscriber_fanout";
  published: number;
};

export async function routeGameEvent(
  input: unknown,
  queue: QueuePublisher,
): Promise<FanoutResult> {
  const event = gameEventSchema.parse(input);

  if (event.kind === "player_asset_created") {
    await queue.publish(
      "moderation-reviews",
      {
        type: "moderation_review_requested",
        event_id: event.eventId,
        asset: event.asset,
      },
      `moderation:${event.eventId}`,
    );
    return { eventId: event.eventId, route: "moderation", published: 1 };
  }

  await Promise.all(
    event.subscribers.map((subscriber) =>
      queue.publish(
        "subscriber-notifications",
        {
          type: "live_event_notification",
          event_id: event.eventId,
          live_event: event.liveEvent,
          recipient: subscriber,
        },
        `fanout:${event.eventId}:${subscriber.playerId}:${subscriber.channel}`,
      ),
    ),
  );

  return {
    eventId: event.eventId,
    route: "subscriber_fanout",
    published: event.subscribers.length,
  };
}
