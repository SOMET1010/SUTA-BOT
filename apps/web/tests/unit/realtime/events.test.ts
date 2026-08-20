import { describe, expect, it } from "vitest";
import { normalizeServerEvent } from "@/lib/realtime/events";

describe("normalizeServerEvent", () => {
  it("maps speech_started / speech_stopped", () => {
    expect(normalizeServerEvent({ type: "input_audio_buffer.speech_started" })).toEqual({
      type: "speech_started",
    });
    expect(normalizeServerEvent({ type: "input_audio_buffer.speech_stopped" })).toEqual({
      type: "speech_stopped",
    });
  });

  it("maps user transcript delta/done", () => {
    expect(
      normalizeServerEvent({
        type: "conversation.item.input_audio_transcription.delta",
        delta: "Comment ",
        item_id: "item_1",
      }),
    ).toEqual({ type: "user_transcript_delta", delta: "Comment " });

    expect(
      normalizeServerEvent({
        type: "conversation.item.input_audio_transcription.completed",
        transcript: "Comment bénéficier de ce programme ?",
        item_id: "item_1",
      }),
    ).toEqual({
      type: "user_transcript_done",
      transcript: "Comment bénéficier de ce programme ?",
    });
  });

  it("maps assistant transcript delta/done", () => {
    expect(
      normalizeServerEvent({
        type: "response.output_audio_transcript.delta",
        delta: "Bonjour",
        response_id: "resp_1",
      }),
    ).toEqual({ type: "assistant_transcript_delta", delta: "Bonjour" });

    expect(
      normalizeServerEvent({
        type: "response.output_audio_transcript.done",
        transcript: "Bonjour, je suis SUTA.",
      }),
    ).toEqual({ type: "assistant_transcript_done", transcript: "Bonjour, je suis SUTA." });
  });

  it("maps response lifecycle events", () => {
    expect(normalizeServerEvent({ type: "response.created", response: {} })).toEqual({
      type: "response_created",
    });
    expect(normalizeServerEvent({ type: "response.done", response: {} })).toEqual({
      type: "response_done",
    });
  });

  it("maps a completed function call", () => {
    expect(
      normalizeServerEvent({
        type: "response.function_call_arguments.done",
        call_id: "call_abc123",
        name: "search_knowledge",
        arguments: '{"query":"contact ANSUT"}',
      }),
    ).toEqual({
      type: "function_call_done",
      callId: "call_abc123",
      name: "search_knowledge",
      argumentsJson: '{"query":"contact ANSUT"}',
    });
  });

  it("maps error events, falling back to a generic message", () => {
    expect(
      normalizeServerEvent({ type: "error", error: { message: "rate limit exceeded" } }),
    ).toEqual({ type: "error", message: "rate limit exceeded" });

    expect(normalizeServerEvent({ type: "error", error: {} })).toEqual({
      type: "error",
      message: "Le moteur Realtime a signalé une erreur.",
    });
  });

  it("ignores benign cancellation-race errors instead of treating them as fatal", () => {
    expect(
      normalizeServerEvent({
        type: "error",
        error: { message: "Cancellation failed: no active response found" },
      }),
    ).toBeNull();
    expect(
      normalizeServerEvent({
        type: "error",
        error: { message: "cancellation failed: no active response found" },
      }),
    ).toBeNull();
  });

  it("ignores events it doesn't recognize or care about", () => {
    expect(normalizeServerEvent({ type: "session.created", session: {} })).toBeNull();
    expect(normalizeServerEvent({ type: "rate_limits.updated" })).toBeNull();
    expect(normalizeServerEvent({ type: "conversation.item.created" })).toBeNull();
  });

  it("returns null for malformed input rather than throwing", () => {
    expect(normalizeServerEvent(null)).toBeNull();
    expect(normalizeServerEvent(undefined)).toBeNull();
    expect(normalizeServerEvent("not json")).toBeNull();
    expect(normalizeServerEvent({})).toBeNull();
    expect(
      normalizeServerEvent({ type: "conversation.item.input_audio_transcription.delta" }),
    ).toBeNull();
  });
});
