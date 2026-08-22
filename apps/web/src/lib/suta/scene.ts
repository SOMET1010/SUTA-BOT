import type { SutaAction, SutaVisual } from "./visuals";

/** Etat emotionnel independant de l'etat technique de la conversation. */
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
 * Une scene decrit la mise en scene de la reponse de SUTA.
 * L'etat vocal (LISTENING, SPEAKING...) reste gere par la machine existante.
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
