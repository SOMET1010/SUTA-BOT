import { describe, expect, it } from "vitest";
import { cleanText } from "../../src/ingestion/clean";

describe("cleanText", () => {
  it("normalizes Windows line endings", () => {
    expect(cleanText("a\r\nb")).toBe("a\nb");
  });

  it("collapses repeated blank lines", () => {
    expect(cleanText("a\n\n\n\n\nb")).toBe("a\n\nb");
  });

  it("trims trailing whitespace on each line", () => {
    expect(cleanText("a   \nb\t\n")).toBe("a\nb");
  });

  it("collapses repeated spaces/tabs", () => {
    expect(cleanText("a    b\tc")).toBe("a b c");
  });
});
