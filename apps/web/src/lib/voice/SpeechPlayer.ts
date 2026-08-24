/**
 * Lecteur vocal du mode azure-tts (lot 3) : reçoit les phrases du cerveau
 * une à une, les fait synthétiser par /api/voice/speak (la clé Azure reste
 * côté serveur) et les joue dans l'ordre, sans chevauchement.
 *
 * stop() est le geste d'interruption : il vide la file, interrompt la
 * synthèse en cours et coupe la lecture immédiatement — c'est le pendant
 * local du response.cancel que RealtimeClient envoie au cerveau. Comme
 * RealtimeClient, ce module vit dans le navigateur et n'est pas testable
 * unitairement ; la logique découpable (phrases) l'est, dans
 * sentence-stream.ts.
 *
 * Limite connue, à mesurer au banc avant toute bascule : l'audio sort par
 * les haut-parleurs LOCAUX (pas par WebRTC), donc l'annulation d'écho du
 * micro doit absorber la voix de SUTA pour que le VAD ne s'auto-interrompe
 * pas — exactement le genre de défaut que V-INTERRUPTION et V-REPETITION
 * savent entendre.
 */
export class SpeechPlayer {
  private queue: string[] = [];
  private pumping = false;
  private currentAudio: HTMLAudioElement | null = null;
  private currentFetch: AbortController | null = null;
  private generation = 0;

  constructor(
    private readonly options: {
      voice?: string;
      onSpeakingChange?: (speaking: boolean) => void;
      onError?: (message: string) => void;
    } = {},
  ) {}

  /** Ajoute une phrase à prononcer ; démarre la lecture si rien ne joue. */
  enqueue(text: string): void {
    const phrase = text.trim();
    if (!phrase) return;
    this.queue.push(phrase);
    void this.pump();
  }

  /** Interruption : plus rien ne doit sortir, tout de suite. */
  stop(): void {
    this.generation += 1;
    this.queue = [];
    this.currentFetch?.abort();
    this.currentFetch = null;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = "";
      this.currentAudio = null;
    }
    if (this.pumping) {
      this.pumping = false;
      this.options.onSpeakingChange?.(false);
    }
  }

  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    this.options.onSpeakingChange?.(true);
    const generation = this.generation;
    while (this.queue.length > 0 && generation === this.generation) {
      const phrase = this.queue.shift();
      if (!phrase) continue;
      try {
        const controller = new AbortController();
        this.currentFetch = controller;
        const response = await fetch("/api/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: phrase, ...(this.options.voice ? { voice: this.options.voice } : {}) }),
          signal: controller.signal,
        });
        this.currentFetch = null;
        if (generation !== this.generation) break;
        if (!response.ok) {
          const detail = (await response.json().catch(() => null)) as { error?: string } | null;
          this.options.onError?.(detail?.error ?? `Synthèse vocale indisponible (HTTP ${response.status}).`);
          continue;
        }
        const url = URL.createObjectURL(await response.blob());
        if (generation !== this.generation) { URL.revokeObjectURL(url); break; }
        await this.play(url, generation);
        URL.revokeObjectURL(url);
      } catch (error) {
        if ((error as { name?: string })?.name !== "AbortError") {
          this.options.onError?.("La synthèse vocale a échoué sur une phrase.");
        }
      }
    }
    if (generation === this.generation && this.pumping) {
      this.pumping = false;
      this.options.onSpeakingChange?.(false);
    }
  }

  private play(url: string, generation: number): Promise<void> {
    return new Promise((resolve) => {
      if (generation !== this.generation) { resolve(); return; }
      const audio = new Audio(url);
      this.currentAudio = audio;
      audio.onended = () => { if (this.currentAudio === audio) this.currentAudio = null; resolve(); };
      audio.onerror = () => { if (this.currentAudio === audio) this.currentAudio = null; resolve(); };
      audio.play().catch(() => resolve());
    });
  }
}
