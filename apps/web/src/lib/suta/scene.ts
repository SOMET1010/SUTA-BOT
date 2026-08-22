import type { SutaAction, SutaVisual } from "./visuals";

/** État émotionnel indépendant de l'état technique de la conversation. */
export type SutaEmotion =
  | "neutral"
  | "warm"
  | "curious"
  | "thinking"
  | "explaining"
  | "reassuring"
  | "celebrating"
  | "alert";

/**
 * Une scène décrit la mise en scène de la réponse de SUTA.
 * L'état vocal (LISTENING, SPEAKING...) reste géré par la machine existante.
 */
export interface SutaScene {
  emotion: SutaEmotion;
  visual: SutaVisual | null;
  emphasis?: string;
  actions?: SutaAction[];
}

export const DEFAULT_SUTA_SCENE: SutaScene = {
  emotion: "warm",
  visual: null,
};

export function sceneForVisual(
  visual: SutaVisual | null,
  emotion: SutaEmotion = "explaining",
): SutaScene {
  return {
    emotion,
    visual,
    actions: visual?.actions,
  };
}
