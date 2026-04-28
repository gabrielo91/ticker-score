/**
 * OpenAI Chat Completions client for the narrative provider. Native `fetch`
 * only (Constitution: no SDKs). Uses JSON-mode (`response_format = json_object`)
 * so the model is forced to return a JSON document. Schema validation lives
 * in the provider, not here — this layer owns the transport.
 *
 * Returns `Result<string>` carrying the raw assistant content; mapping to
 * `NarrativeError` codes is the provider's responsibility.
 *
 * Errors mapped here:
 *  - 401/403       → AUTH (surfaces as TRANSPORT to the provider with details)
 *  - 429           → RATE_LIMITED
 *  - timeout/abort → TIMEOUT
 *  - non-2xx other → TRANSPORT
 */
import { err, ok, type Result } from "@darkscore/types";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_TOKENS = 4_096;
const DEFAULT_TEMPERATURE = 0.2;

export type OpenAIErrorKind = "auth" | "rate_limited" | "timeout" | "transport";

export class OpenAIClientError extends Error {
  readonly kind: OpenAIErrorKind;
  readonly status: number | null;
  readonly body: string | null;
  constructor(
    kind: OpenAIErrorKind,
    message: string,
    status: number | null = null,
    body: string | null = null,
  ) {
    super(message);
    this.name = "OpenAIClientError";
    this.kind = kind;
    this.status = status;
    this.body = body;
  }
}

export interface OpenAIClientOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly maxTokens?: number;
  readonly temperature?: number;
}

export interface OpenAIChatRequest {
  readonly systemPrompt: string;
  readonly userPrompt: string;
}

export class OpenAIClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxTokens: number;
  private readonly temperature: number;

  constructor(options: OpenAIClientOptions) {
    if (typeof options.apiKey !== "string" || options.apiKey.length === 0) {
      throw new Error("OpenAIClient: apiKey is required");
    }
    if (typeof options.model !== "string" || options.model.length === 0) {
      throw new Error("OpenAIClient: model is required");
    }
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/u, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.temperature = options.temperature ?? DEFAULT_TEMPERATURE;
  }

  /**
   * Issue one chat completion in JSON mode and return the raw assistant
   * content. The caller parses + validates the JSON.
   */
  async chatJson(req: OpenAIChatRequest): Promise<Result<string, OpenAIClientError>> {
    const url = `${this.baseUrl}/chat/completions`;
    const body = JSON.stringify({
      model: this.model,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: req.systemPrompt },
        { role: "user", content: req.userPrompt },
      ],
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body,
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await safeReadBody(response);
        const kind: OpenAIErrorKind =
          response.status === 401 || response.status === 403
            ? "auth"
            : response.status === 429
              ? "rate_limited"
              : "transport";
        return err(
          new OpenAIClientError(
            kind,
            `OpenAIClient: ${response.status} ${response.statusText}${text !== "" ? ` — ${text}` : ""}`,
            response.status,
            text,
          ),
        );
      }
      const json = (await response.json()) as unknown;
      const content = extractContent(json);
      if (content === null) {
        return err(
          new OpenAIClientError("transport", "OpenAIClient: response missing choices[0].message.content"),
        );
      }
      return ok(content);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const kind: OpenAIErrorKind = controller.signal.aborted ? "timeout" : "transport";
      return err(new OpenAIClientError(kind, `OpenAIClient: ${message}`));
    } finally {
      clearTimeout(timeout);
    }
  }
}

function extractContent(json: unknown): string | null {
  if (typeof json !== "object" || json === null) return null;
  const choices = (json as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0] as { message?: { content?: unknown } } | undefined;
  const content = first?.message?.content;
  return typeof content === "string" ? content : null;
}

async function safeReadBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 300);
  } catch {
    return "";
  }
}

