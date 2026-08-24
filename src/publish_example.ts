import { InfraiQueue } from "./infrai_queue.js";
import { routeGameEvent } from "./notification_fanout.js";

const result = await routeGameEvent(
  {
    eventId: "live-2026-finals",
    kind: "live_event_started",
    liveEvent: { liveEventId: "final-round", title: "Founders Cup Final" },
    subscribers: [
      { playerId: "player-17", channel: "in_game" },
      { playerId: "player-42", channel: "push" },
    ],
  },
  new InfraiQueue(),
);

console.log(result);
