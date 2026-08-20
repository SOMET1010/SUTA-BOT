import { describe, expect, it } from "vitest";
import {
  signAdminSession,
  verifyAdminPassword,
  verifyAdminSession,
} from "../src/admin-session";

describe("verifyAdminPassword", () => {
  it("accepts the correct password", () => {
    expect(verifyAdminPassword("secret123", "secret123")).toBe(true);
  });

  it("rejects an incorrect password", () => {
    expect(verifyAdminPassword("wrong", "secret123")).toBe(false);
  });

  it("rejects passwords of different lengths without throwing", () => {
    expect(verifyAdminPassword("a", "a-much-longer-password")).toBe(false);
  });
});

describe("signAdminSession / verifyAdminSession", () => {
  it("accepts a freshly signed token", () => {
    const token = signAdminSession("my-secret");
    expect(verifyAdminSession(token, "my-secret")).toBe(true);
  });

  it("rejects a token signed with a different secret", () => {
    const token = signAdminSession("my-secret");
    expect(verifyAdminSession(token, "other-secret")).toBe(false);
  });

  it("rejects a tampered expiry (signature mismatch)", () => {
    const token = signAdminSession("my-secret");
    const [, signature] = token.split(".");
    const tampered = `${Date.now() + 999_999_999}.${signature}`;
    expect(verifyAdminSession(tampered, "my-secret")).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = signAdminSession("my-secret", -1); // already expired
    expect(verifyAdminSession(token, "my-secret")).toBe(false);
  });

  it("rejects malformed tokens", () => {
    expect(verifyAdminSession("not-a-token", "my-secret")).toBe(false);
    expect(verifyAdminSession("", "my-secret")).toBe(false);
    expect(verifyAdminSession(undefined, "my-secret")).toBe(false);
    expect(verifyAdminSession(null, "my-secret")).toBe(false);
  });
});
