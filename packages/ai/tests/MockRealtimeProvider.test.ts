import { describe, expect, it } from "vitest";
import { MockRealtimeProvider } from "../src/realtime/MockRealtimeProvider";

describe("MockRealtimeProvider", () => {
  it("creates a session without contacting any external service", async () => {
    const provider = new MockRealtimeProvider();
    const session = await provider.createSession({ conversationId: "conv-1" });

    expect(session.provider).toBe("mock");
    expect(session.sessionId).toMatch(/^mock_/);
    expect(session.clientSecret).toMatch(/^mock_secret_/);
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("tracks active sessions and releases them on disconnect", async () => {
    const provider = new MockRealtimeProvider();
    const session = await provider.createSession();

    expect(provider.getActiveSessionCount()).toBe(1);

    await provider.disconnect(session.sessionId);

    expect(provider.getActiveSessionCount()).toBe(0);
  });

  it("never returns a real/permanent-looking secret", async () => {
    const provider = new MockRealtimeProvider();
    const session = await provider.createSession();

    expect(session.clientSecret).not.toMatch(/sk-/);
    expect(session.clientSecret.startsWith("mock_")).toBe(true);
  });
});
