import { describe, expect, it } from "vitest";
import {
  NARRATIVE_PROMPT_VERSION,
  NARRATIVE_SYSTEM_PROMPT,
} from "./prompt.js";

describe("narrative prompt", () => {
  it("pins the prompt version so cache invalidation is explicit", () => {
    expect(NARRATIVE_PROMPT_VERSION).toBe("4");
  });

  it("includes the QUALITY BAR section that demands specificity", () => {
    expect(NARRATIVE_SYSTEM_PROMPT).toContain("QUALITY BAR");
  });
});

