import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AzureRealtimeProvider } from "../src/realtime/AzureRealtimeProvider";

const baseConfig = {
  endpoint: "https://dtdi-openai-audio-01.openai.azure.com/",
  apiKey: "fake-key-for-test",
  deployment: "gpt-realtime-2.1",
};

describe("AzureRealtimeProvider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to the GA client_secrets endpoint with the api-key header", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ value: "ek_test123", expires_at: 1_800_000_060 }), {
        status: 200,
      }),
    );

    const provider = new AzureRealtimeProvider(baseConfig);
    await provider.createSession({ instructions: "Tu es SUTA." });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://dtdi-openai-audio-01.openai.azure.com/openai/v1/realtime/client_secrets",
    );
    expect(init.headers["api-key"]).toBe("fake-key-for-test");
    expect(init.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body);
    expect(body.session.type).toBe("realtime");
    expect(body.session.model).toBe("gpt-realtime-2.1");
    expect(body.session.instructions).toBe("Tu es SUTA.");
    expect(body.session.tools).toBeUndefined();
  });

  it("maps the ephemeral client_secret response to a RealtimeSession", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ value: "ek_abc", expires_at: 1_800_000_060 }), {
        status: 200,
      }),
    );

    const provider = new AzureRealtimeProvider(baseConfig);
    const session = await provider.createSession();

    expect(session.provider).toBe("azure");
    expect(session.clientSecret).toBe("ek_abc");
    expect(session.model).toBe("gpt-realtime-2.1");
    expect(session.expiresAt).toBe(new Date(1_800_000_060 * 1000).toISOString());
    expect(session.sessionId).toMatch(/^azure_/);
  });

  it("includes flat function-tool descriptors when tools are provided", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ value: "ek_abc", expires_at: 1_800_000_060 }), {
        status: 200,
      }),
    );

    const provider = new AzureRealtimeProvider(baseConfig);
    await provider.createSession({
      tools: [
        {
          name: "search_knowledge",
          description: "Recherche documentaire ANSUT",
          parameters: { type: "object", properties: {} },
        },
      ],
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.session.tools).toEqual([
      {
        type: "function",
        name: "search_knowledge",
        description: "Recherche documentaire ANSUT",
        parameters: { type: "object", properties: {} },
      },
    ]);
  });

  it("throws a clear error when Azure responds with a non-2xx status", async () => {
    fetchMock.mockResolvedValue(new Response("invalid deployment", { status: 404 }));

    const provider = new AzureRealtimeProvider(baseConfig);
    await expect(provider.createSession()).rejects.toThrow(/HTTP 404/);
  });

  it("disconnect is a no-op (no server-side session to close)", async () => {
    const provider = new AzureRealtimeProvider(baseConfig);
    await expect(provider.disconnect("azure_whatever")).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
