import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError, InfraiQueue } from "./infrai_queue.js";
import { routeGameEvent } from "./notification_fanout.js";

const port = Number(process.env.PORT ?? 3000);
const queue = new InfraiQueue();

function sendJson(
  response: import("node:http").ServerResponse,
  status: number,
  body: unknown,
) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/game-events") {
    sendJson(response, 404, { error: "route_not_found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const result = await routeGameEvent(body, queue);
    sendJson(response, 202, result);
  } catch (error) {
    if (error instanceof ZodError) {
      sendJson(response, 400, { error: "invalid_game_event", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      sendJson(response, status, { error: error.code, message: error.message });
      return;
    }
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: "invalid_json" });
      return;
    }
    sendJson(response, 502, { error: "notification_delivery_failed" });
  }
}).listen(port, () => {
  console.log(`Game notification service listening on http://localhost:${port}`);
});
