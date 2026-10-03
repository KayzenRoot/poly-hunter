import { describe, expect, it } from "vitest";
import { createFixedClock } from "@polyhunter/testkit";

describe("createFixedClock", () => {
  it("returns a fresh date for the same fixed instant", () => {
    const input = new Date("2026-10-03T00:00:00.000Z");
    const clock = createFixedClock(input);
    input.setUTCFullYear(2000);

    const first = clock();
    first.setUTCFullYear(2001);

    expect(clock().toISOString()).toBe("2026-10-03T00:00:00.000Z");
  });

  it("rejects an invalid instant", () => {
    expect(() => createFixedClock(Number.NaN)).toThrow(RangeError);
  });
});
