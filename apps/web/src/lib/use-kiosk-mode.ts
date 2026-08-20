"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  // Le mode kiosque est déterminé une fois au chargement ; rien à observer.
  return () => {};
}

function getSnapshot() {
  return new URLSearchParams(window.location.search).get("mode") === "kiosk";
}

function getServerSnapshot() {
  return false;
}

/**
 * Détecte le mode kiosque (`?mode=kiosk`, cahier des charges section 23).
 * `useSyncExternalStore` évite tout écart d'hydratation entre le rendu
 * serveur (toujours `false`) et le rendu client une fois monté.
 */
export function useKioskMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
