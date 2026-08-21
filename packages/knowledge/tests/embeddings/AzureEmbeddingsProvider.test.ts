import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AzureEmbeddingsProvider } from "../../src/embeddings/AzureEmbeddingsProvider";

const baseConfig = {
  endpoint: "https://dtdi-openai-audio-01.openai.azure.com/",
  apiKey: "fake-key-for-test",
  deployment: "text-embedding-3-small",
};

describe("AzureEmbeddingsProvider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to the GA embeddings endpoint with the api-key header", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { embedding: [0.1, 0.2], index: 0 },
            { embedding: [0.3, 0.4], index: 1 },
          ],
        }),
        { status: 200 },
      ),
    );

    const provider = new AzureEmbeddingsProvider(baseConfig);
    const result = await provider.embed(["texte un", "texte deux"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://dtdi-openai-audio-01.openai.azure.com/openai/v1/embeddings",
    );
    expect(init.headers["api-key"]).toBe("fake-key-for-test");
    expect(init.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body);
    expect(body.model).toBe("text-embedding-3-small");
    expect(body.input).toEqual(["texte un", "texte deux"]);

    expect(result).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });

  it("reorders results by index in case the API returns them out of order", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { embedding: [9, 9], index: 1 },
            { embedding: [1, 1], index: 0 },
          ],
        }),
        { status: 200 },
      ),
    );

    const provider = new AzureEmbeddingsProvider(baseConfig);
    const result = await provider.embed(["a", "b"]);

    expect(result).toEqual([
      [1, 1],
      [9, 9],
    ]);
  });

  it("returns an empty array without calling fetch for an empty input", async () => {
    const provider = new AzureEmbeddingsProvider(baseConfig);
    const result = await provider.embed([]);

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws a clear error when Azure responds with a non-2xx status", async () => {
    fetchMock.mockResolvedValue(new Response("invalid deployment", { status: 404 }));

    const provider = new AzureEmbeddingsProvider(baseConfig);
    await expect(provider.embed(["texte"])).rejects.toThrow(/HTTP 404/);
  });

  it("throws when required config is missing", () => {
    expect(
      () => new AzureEmbeddingsProvider({ endpoint: "", apiKey: "", deployment: "" }),
    ).toThrow(/endpoint, apiKey et deployment sont requis/);
  });
});
