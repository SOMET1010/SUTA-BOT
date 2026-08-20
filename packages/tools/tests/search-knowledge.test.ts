import { beforeEach, describe, expect, it, vi } from "vitest";

const searchDocumentsMock = vi.fn();

vi.mock("@suta/knowledge", () => ({
  searchDocuments: (...args: unknown[]) => searchDocumentsMock(...args),
}));

const { searchKnowledgeTool } = await import("../src/search-knowledge");
const { runTool, describeTool, ToolInputError } = await import("../src/types");

describe("searchKnowledgeTool", () => {
  beforeEach(() => {
    searchDocumentsMock.mockReset();
    searchDocumentsMock.mockResolvedValue({
      results: [{ title: "Doc", content: "Contenu", source: "Doc", score: 0.9 }],
    });
  });

  it("rejects an empty query", async () => {
    await expect(runTool(searchKnowledgeTool, { query: "" })).rejects.toThrow(ToolInputError);
    expect(searchDocumentsMock).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range limit", async () => {
    await expect(runTool(searchKnowledgeTool, { query: "x", limit: 50 })).rejects.toThrow(
      ToolInputError,
    );
  });

  it("executes with a valid query and forwards the default limit", async () => {
    const result = await runTool(searchKnowledgeTool, { query: "Quels programmes ?" });
    expect(searchDocumentsMock).toHaveBeenCalledWith(
      "Quels programmes ?",
      expect.objectContaining({ limit: 5, visibility: ["PUBLIC", "DEMO"] }),
    );
    expect(result.results).toHaveLength(1);
  });

  it("ignores an attempted visibility override in the raw input (security)", async () => {
    // Un payload malveillant (ex. via injection de prompt) ne doit jamais
    // pouvoir élargir la visibilité recherchée.
    await runTool(searchKnowledgeTool, {
      query: "Informations confidentielles",
      visibility: "ADMIN",
    } as never);

    expect(searchDocumentsMock).toHaveBeenCalledWith(
      "Informations confidentielles",
      expect.objectContaining({ visibility: ["PUBLIC", "DEMO"] }),
    );
  });

  it("describes the tool without exposing a visibility parameter", () => {
    const descriptor = describeTool(searchKnowledgeTool);
    expect(descriptor.name).toBe("search_knowledge");
    const properties = (descriptor.parameters as { properties: Record<string, unknown> })
      .properties;
    expect(Object.keys(properties)).toEqual(["query", "limit"]);
  });
});
