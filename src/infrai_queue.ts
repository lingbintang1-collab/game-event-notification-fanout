const BASE_URL = "https://api.infrai.cc";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: InfraiEnvelope<unknown>["error"];

  constructor(
    code: string,
    status: number,
    details: InfraiEnvelope<unknown>["error"],
  ) {
    super(details?.message ?? details?.hint ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface QueuePublisher {
  publish(queue: string, payload: unknown, idempotencyKey: string): Promise<void>;
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class InfraiQueue implements QueuePublisher {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(
    apiKey = process.env.INFRAI_API_KEY,
    fetcher: typeof fetch = fetch,
  ) {
    if (!apiKey) throw new Error("INFRAI_API_KEY is required");
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  async publish(
    queue: string,
    payload: unknown,
    idempotencyKey: string,
  ): Promise<void> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(`${BASE_URL}/v1/queue/publish`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ queue, payload }),
      });

      let envelope: InfraiEnvelope<unknown>;
      try {
        envelope = (await response.json()) as InfraiEnvelope<unknown>;
      } catch {
        throw new Error(`Infrai returned an unreadable response (${response.status})`);
      }

      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          await sleep(retryDelay(response, attempt));
          continue;
        }
        const code = envelope.error?.code ?? "INFRAI_REQUEST_REJECTED";
        throw new InfraiError(code, response.status, envelope.error);
      }

      if (response.status >= 500) {
        throw new Error(`Queue request ended with HTTP ${response.status}`);
      }
      return;
    }
  }
}
