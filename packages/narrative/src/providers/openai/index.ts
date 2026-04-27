/**
 * `OpenAINarrativeProvider` — implements `NarrativeProvider` against
 * OpenAI's Chat Completions API in JSON mode. Wires:
 *   prompt builder (prompt.ts) → HTTP client (client.ts) → Zod validation.
 *
 * Constitutional alignment:
 *  - C1: implements the cross-provider `NarrativeProvider` interface.
 *  - C3: every model response is parsed through `NarrativeDataSchema`
 *        before any field is read; malformed output ⇒ `Result.err`.
 *  - C5: every public method returns `Result` — no thrown errors leak.
 *  - Spec 002 grounding rules: closed input, JSON mode, T<=0.2, mandatory
 *    disclaimer (added by the schema and surfaced by the prompt).
 *
 * Provider metadata (`providerName`, `model`, `generatedAt`) is set by the
 * provider itself, not by the model — those fields are NOT part of the
 * model's JSON output.
 */
import {
  ForwardEstimatesSchema,
  NarrativeDataSchema,
  err,
  isErr,
  ok,
  type NarrativeData,
  type NarrativeInput,
  type NarrativeProvider,
  type Result,
} from "@darkscore/types";
import { NarrativeError } from "../../errors.js";
import {
  OpenAIClient,
  OpenAIClientError,
  type OpenAIClientOptions,
} from "./client.js";
import { NARRATIVE_SYSTEM_PROMPT, buildUserPrompt } from "./prompt.js";

export const OPENAI_PROVIDER_NAME = "openai";
export const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
/** W5-2: forward-estimate guardrails require deterministic decoding. */
export const NARRATIVE_TEMPERATURE = 0;

export interface OpenAINarrativeProviderOptions
  extends Omit<OpenAIClientOptions, "model"> {
  readonly name?: string;
  readonly model?: string;
  readonly client?: OpenAIClient;
  /** Injection point for stable `generatedAt` in tests. */
  readonly now?: () => Date;
}

export class OpenAINarrativeProvider implements NarrativeProvider {
  readonly name: string;
  readonly model: string;
  private readonly client: OpenAIClient;
  private readonly now: () => Date;

  constructor(options: OpenAINarrativeProviderOptions) {
    this.name = options.name ?? OPENAI_PROVIDER_NAME;
    this.model = options.model ?? OPENAI_DEFAULT_MODEL;
    this.client =
      options.client ??
      new OpenAIClient({
        ...options,
        model: this.model,
        // Forward estimates demand a deterministic decode (W5-2). Pin
        // temperature to 0 unless the caller explicitly overrode it.
        temperature: options.temperature ?? NARRATIVE_TEMPERATURE,
      });
    this.now = options.now ?? (() => new Date());
  }

  /**
   * Cheap reachability probe. We don't issue a network call here — the
   * presence of an API key (already validated in the client constructor)
   * is the available signal. The orchestrator (`apps/web`, W4-4) will skip
   * registration entirely when the env var is missing, so reaching this
   * method implies a configured provider.
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generate(input: NarrativeInput): Promise<Result<NarrativeData>> {
    const transport = await this.client.chatJson({
      systemPrompt: NARRATIVE_SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(input),
    });
    if (isErr(transport)) {
      return err(this.mapClientError(transport.error));
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(transport.data);
    } catch (e) {
      return err(
        new NarrativeError(
          this.name,
          "SCHEMA",
          "OpenAINarrativeProvider: model returned non-JSON content",
          e instanceof Error ? e.message : String(e),
        ),
      );
    }

    const candidate = this.attachMetadata(this.salvageForwardEstimates(parsedJson));
    const parsed = NarrativeDataSchema.safeParse(candidate);
    if (!parsed.success) {
      return err(
        new NarrativeError(
          this.name,
          "SCHEMA",
          "OpenAINarrativeProvider: model output failed NarrativeDataSchema validation",
          parsed.error.message,
        ),
      );
    }
    return ok(parsed.data);
  }

  /**
   * Merge model-supplied content with provider-controlled metadata. The
   * model is instructed not to populate `providerName`/`model`/`generatedAt`,
   * but if it does we overwrite — the provider is the source of truth for
   * audit fields.
   */
  private attachMetadata(content: unknown): unknown {
    const base =
      typeof content === "object" && content !== null
        ? (content as Record<string, unknown>)
        : {};
    return {
      ...base,
      providerName: this.name,
      model: this.model,
      generatedAt: this.now().toISOString(),
    };
  }

  /**
   * W5-2 anti-hallucination: forward estimates are a best-effort field. If
   * the model omits them we set `forwardEstimates: null`; if they fail
   * `ForwardEstimatesSchema` we drop them to `null` rather than failing the
   * whole narrative. The full-document `NarrativeDataSchema.safeParse` then
   * accepts the salvaged candidate cleanly.
   */
  private salvageForwardEstimates(content: unknown): unknown {
    if (typeof content !== "object" || content === null) return content;
    const base = content as Record<string, unknown>;
    const raw = base.forwardEstimates;
    if (raw === undefined || raw === null) {
      return { ...base, forwardEstimates: null };
    }
    const parsed = ForwardEstimatesSchema.safeParse(raw);
    return { ...base, forwardEstimates: parsed.success ? parsed.data : null };
  }

  private mapClientError(e: OpenAIClientError): NarrativeError {
    switch (e.kind) {
      case "auth":
        return new NarrativeError(this.name, "NOT_CONFIGURED", e.message, e.body);
      case "rate_limited":
        return new NarrativeError(this.name, "RATE_LIMITED", e.message, e.body);
      case "timeout":
        return new NarrativeError(this.name, "TIMEOUT", e.message, e.body);
      case "transport":
      default:
        return new NarrativeError(this.name, "TRANSPORT", e.message, e.body);
    }
  }
}

export function createOpenAINarrativeProvider(
  options: OpenAINarrativeProviderOptions,
): OpenAINarrativeProvider {
  return new OpenAINarrativeProvider(options);
}

