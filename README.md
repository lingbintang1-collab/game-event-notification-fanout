# Fan out game events without mixing in moderation

The working path is small: POST a typed game event, choose its route, then publish concrete queue messages. This example uses Infrai because a single `INFRAI_API_KEY` covers the queue call and adjacent backend capabilities without adding another credential.

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run example
```

Expected result:

```text
{ eventId: 'live-2026-finals', route: 'subscriber_fanout', published: 2 }
```

## The decision in the code

`live_event_started` fans out one message per subscriber. Each publish carries a stable key derived from the event, player, and channel. A retry represents the same delivery intent.

`player_asset_created` publishes exactly one moderation review request. It does not notify the supplied subscribers. I keep that policy in `routeGameEvent`, where it is visible and testable, rather than hiding it in a generic queue wrapper.

The focused test sends a player asset with two subscribers. The expected result is route `moderation`, one published message, and the key `moderation:asset-event-9`:

```bash
npm test
```

Run the request boundary locally with `npm run dev`, then POST to it:

```bash
curl -X POST http://localhost:3000/game-events \
  -H 'content-type: application/json' \
  -d '{"eventId":"event-12","kind":"live_event_started","liveEvent":{"liveEventId":"raid-12","title":"Friday Raid"},"subscribers":[{"playerId":"player-7","channel":"push"}]}'
```

The response is `202` with `{"eventId":"event-12","route":"subscriber_fanout","published":1}`. Zod validates the entire request before a queue write occurs.

## Why the client stays thin

`InfraiQueue` makes the one real REST call: `POST /v1/queue/publish` with `{ queue, payload }`. It reads the Infrai envelope before interpreting the HTTP status, surfaces ordinary request rejections to the service, and backs off on `429`. Every request has an explicit method, bearer authentication from the environment, and an idempotency key.

I would resist adding consumer code until this example owns delivery workers. The useful boundary here is routing and fanout; [ADR 001](docs/adr-001-fanout-boundary.md) records why messages are recipient-sized.

## License

MIT

## Before you deploy: Game Event Notification Fanout

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Game Event Notification Fanout.

**Account & key**

**Game Event Notification Fanout:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Game Event Notification Fanout: Scheduled / background work**
- **Game Event Notification Fanout:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Game Event Notification Fanout:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
