import { describe, expect, it } from "vitest";
import { createResilientRealtimeProvider, FallbackRealtimeProvider } from "../src/realtime/factory";
import { MockRealtimeProvider } from "../src/realtime/MockRealtimeProvider";

describe("createResilientRealtimeProvider", () => {
  it("returns MockRealtimeProvider directly when AI_PROVIDER=mock (nothing to wrap)", () => {
    const provider = createResilientRealtimeProvider({ AI_PROVIDER: "mock" });
    expect(provider).toBeInstanceOf(MockRealtimeProvider);
  });

  it("wraps a working non-mock provider in FallbackRealtimeProvider", () => {
    const provider = createResilientRealtimeProvider({
      AI_PROVIDER: "azure",
      AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
      AZURE_OPENAI_API_KEY: "fake-key",
      REALTIME_DEPLOYMENT: "fake-deployment",
      DEMO_FALLBACK_MODE: "true",
    });
    expect(provider).toBeInstanceOf(FallbackRealtimeProvider);
    expect(provider.name).toBe("azure");
  });

  it("falls back to mock session creation when the primary provider's createSession throws", async () => {
    const provider = createResilientRealtimeProvider({
      AI_PROVIDER: "azure",
      AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
      AZURE_OPENAI_API_KEY: "fake-key",
      REALTIME_DEPLOYMENT: "fake-deployment",
      DEMO_FALLBACK_MODE: "true",
    });

    // AzureRealtimeProvider.createSession is a not-yet-implemented skeleton
    // that always throws — this exercises the real fallback path.
    const session = await provider.createSession();
    expect(session.provider).toBe("mock");
  });

  it("falls back directly to mock when construction itself fails (invalid config)", async () => {
    const provider = createResilientRealtimeProvider({
      AI_PROVIDER: "azure", // missing endpoint/apiKey/deployment
      DEMO_FALLBACK_MODE: "true",
    });
    expect(provider).toBeInstanceOf(MockRealtimeProvider);
    const session = await provider.createSession();
    expect(session.provider).toBe("mock");
  });

  it("does not fall back when DEMO_FALLBACK_MODE=false: session creation throws", async () => {
    const provider = createResilientRealtimeProvider({
      AI_PROVIDER: "azure",
      AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com",
      AZURE_OPENAI_API_KEY: "fake-key",
      REALTIME_DEPLOYMENT: "fake-deployment",
      DEMO_FALLBACK_MODE: "false",
    });
    await expect(provider.createSession()).rejects.toThrow(/pas encore implémenté/);
  });

  it("does not fall back when DEMO_FALLBACK_MODE=false: invalid config throws at creation", () => {
    expect(() =>
      createResilientRealtimeProvider({ AI_PROVIDER: "azure", DEMO_FALLBACK_MODE: "false" }),
    ).toThrow(/endpoint, apiKey et deployment sont requis/);
  });
});
