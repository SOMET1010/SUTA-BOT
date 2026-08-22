import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BARGE_IN_CONFIRM_MS, BargeInGate } from "@/lib/realtime/interruption";

/**
 * Scénarios de recette de l'interruption (constat salon : SUTA se coupait
 * sur des bruits). La partie audio réelle ne se teste qu'en conditions
 * réelles ; ici on fige la DÉCISION : quand annule-t-on, quand ignore-t-on.
 */
describe("BargeInGate — garde d'interruption", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("SUTA parle, personne ne l'interrompt : zéro annulation", () => {
    const gate = new BargeInGate();
    const cancel = vi.fn();
    // 15 secondes s'écoulent sans le moindre speech_started.
    vi.advanceTimersByTime(15_000);
    expect(cancel).not.toHaveBeenCalled();
    gate.reset();
  });

  it("bruit bref ou respiration pendant la réponse : zéro annulation", () => {
    const gate = new BargeInGate();
    const listening = vi.fn();
    const cancel = vi.fn();
    gate.speechStarted(true, listening, cancel);
    vi.advanceTimersByTime(120); // le bruit s'arrête avant la confirmation
    const falseAlarm = gate.speechStopped();
    vi.advanceTimersByTime(5_000);
    expect(falseAlarm).toBe(true);
    expect(cancel).not.toHaveBeenCalled();
    expect(listening).not.toHaveBeenCalled(); // l'UI ne bascule pas non plus
  });

  it("« attends » pendant la réponse : annulation dès la confirmation, une seule fois", () => {
    const gate = new BargeInGate();
    const cancel = vi.fn();
    gate.speechStarted(true, vi.fn(), cancel);
    vi.advanceTimersByTime(BARGE_IN_CONFIRM_MS);
    expect(cancel).toHaveBeenCalledTimes(1);
    // La fin de la phrase de l'utilisateur n'annule pas une seconde fois.
    expect(gate.speechStopped()).toBe(false);
    vi.advanceTimersByTime(5_000);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("hors réponse active : écoute immédiate, aucune temporisation", () => {
    const gate = new BargeInGate();
    const listening = vi.fn();
    const cancel = vi.fn();
    gate.speechStarted(false, listening, cancel);
    expect(listening).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5_000);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("deux bruits successifs réarment proprement la confirmation", () => {
    const gate = new BargeInGate();
    const cancel = vi.fn();
    gate.speechStarted(true, vi.fn(), cancel);
    vi.advanceTimersByTime(150);
    gate.speechStopped();
    gate.speechStarted(true, vi.fn(), cancel);
    vi.advanceTimersByTime(150);
    gate.speechStopped();
    vi.advanceTimersByTime(5_000);
    expect(cancel).not.toHaveBeenCalled();
  });
});
