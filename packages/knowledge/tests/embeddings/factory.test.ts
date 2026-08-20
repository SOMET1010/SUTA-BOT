import { describe, expect, it } from "vitest";
import { createEmbeddingsProvider } from "../../src/embeddings/factory";
import { MockEmbeddingsProvider } from "../../src/embeddings/MockEmbeddingsProvider";
import { AzureEmbeddingsProvider } from "../../src/embeddings/AzureEmbeddingsProvider";
import { OpenAIEmbeddingsProvider } from "../../src/embeddings/OpenAIEmbeddingsProvider";

describe("createEmbeddingsProvider", () => {
  it("defaults to MockEmbeddingsProvider with 1536 dimensions", () => {
    const provider = createEmbeddingsProvider({});
    expect(provider).toBeInstanceOf(MockEmbeddingsProvider);
    expect(provider.dimensions).toBe(1536);
  });

  it("honors EMBEDDING_DIMENSIONS", () => {
    const provider = createEmbeddingsProvider({ EMBEDDING_DIMENSIONS: "8" });
    expect(provider.dimensions).toBe(8);
  });

  it("builds an AzureEmbeddingsProvider from AZURE_OPENAI_* env vars", () => {
    const provider = createEmbeddingsProvider({
      EMBEDDINGS_PROVIDER: "azure",
      AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
      AZURE_OPENAI_API_KEY: "fake-key-for-test",
      EMBEDDINGS_DEPLOYMENT: "fake-deployment",
    });
    expect(provider).toBeInstanceOf(AzureEmbeddingsProvider);
  });

  it("builds an OpenAIEmbeddingsProvider from OPENAI_API_KEY", () => {
    const provider = createEmbeddingsProvider({
      EMBEDDINGS_PROVIDER: "openai",
      OPENAI_API_KEY: "fake-key-for-test",
    });
    expect(provider).toBeInstanceOf(OpenAIEmbeddingsProvider);
  });

  it("rejects an unknown provider name", () => {
    expect(() => createEmbeddingsProvider({ EMBEDDINGS_PROVIDER: "bogus" })).toThrow(
      /EMBEDDINGS_PROVIDER inconnu/,
    );
  });
});
