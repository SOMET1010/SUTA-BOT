import { describe, expect, it } from "vitest";
import { createRealtimeProvider } from "../src/realtime/factory";
import { MockRealtimeProvider } from "../src/realtime/MockRealtimeProvider";
import { AzureRealtimeProvider } from "../src/realtime/AzureRealtimeProvider";
import { OpenAIRealtimeProvider } from "../src/realtime/OpenAIRealtimeProvider";

describe("createRealtimeProvider", () => {
  it("defaults to MockRealtimeProvider when AI_PROVIDER is unset", () => {
    const provider = createRealtimeProvider({});
    expect(provider).toBeInstanceOf(MockRealtimeProvider);
  });

  it("selects MockRealtimeProvider explicitly", () => {
    const provider = createRealtimeProvider({ AI_PROVIDER: "mock" });
    expect(provider).toBeInstanceOf(MockRealtimeProvider);
  });

  it("builds an AzureRealtimeProvider from AZURE_OPENAI_* env vars", () => {
    const provider = createRealtimeProvider({
      AI_PROVIDER: "azure",
      AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
      AZURE_OPENAI_API_KEY: "fake-key-for-test",
      REALTIME_DEPLOYMENT: "fake-deployment",
    });
    expect(provider).toBeInstanceOf(AzureRealtimeProvider);
  });

  it("throws a clear error when Azure config is incomplete", () => {
    expect(() =>
      createRealtimeProvider({ AI_PROVIDER: "azure" }),
    ).toThrow(/endpoint, apiKey et deployment sont requis/);
  });

  it("builds an OpenAIRealtimeProvider from OPENAI_API_KEY", () => {
    const provider = createRealtimeProvider({
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: "fake-key-for-test",
    });
    expect(provider).toBeInstanceOf(OpenAIRealtimeProvider);
  });

  it("rejects an unknown provider name", () => {
    expect(() => createRealtimeProvider({ AI_PROVIDER: "bogus" })).toThrow(
      /AI_PROVIDER inconnu/,
    );
  });
});
