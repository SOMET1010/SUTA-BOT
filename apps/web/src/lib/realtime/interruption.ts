/**
 * Garde d'interruption (barge-in) — décide si une prise de parole détectée
 * pendant que SUTA parle est une vraie interruption ou un faux positif.
 *
 * Constat en conditions réelles (salon, 22/08/2026) : SUTA se coupait puis
 * reprenait sans que personne ne l'interrompe. Le VAD serveur interprétait
 * respirations, bruits brefs ou retour haut-parleur comme une reprise de
 * parole, et le client annulait la réponse dès le premier `speech_started`.
 *
 * Règle : pendant une réponse active, un `speech_started` n'annule rien tant
 * que la parole ne se soutient pas pendant CONFIRM_MS. Un bruit bref émet son
 * `speech_stopped` avant l'échéance : fausse alerte, SUTA continue. Une vraie
 * phrase (« attends… ») dépasse l'échéance : annulation, ressentie comme
 * immédiate (280 ms est sous le seuil de gêne perceptible).
 *
 * Hors réponse active, aucune retenue : la personne parle, on écoute.
 *
 * Classe pure (setTimeout uniquement) pour être testable avec des fake
 * timers, hors navigateur.
 */

export const BARGE_IN_CONFIRM_MS = 280;

export class BargeInGate {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly confirmMs: number = BARGE_IN_CONFIRM_MS) {}

  /**
   * À appeler sur `speech_started`.
   * - Sans réponse active : `onListening` immédiat (écoute normale).
   * - Avec réponse active : arme la confirmation ; `onConfirmedInterrupt`
   *   ne sera appelé que si la parole se soutient.
   */
  speechStarted(responseActive: boolean, onListening: () => void, onConfirmedInterrupt: () => void): void {
    if (!responseActive) {
      this.reset();
      onListening();
      return;
    }
    this.reset();
    this.timer = setTimeout(() => {
      this.timer = null;
      onConfirmedInterrupt();
    }, this.confirmMs);
  }

  /**
   * À appeler sur `speech_stopped`. Rend `true` si une confirmation était en
   * attente (bruit bref → fausse alerte, rien n'a été annulé).
   */
  speechStopped(): boolean {
    const wasPending = this.timer !== null;
    this.reset();
    return wasPending;
  }

  reset(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
