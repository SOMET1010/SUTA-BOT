import type { NextConfig } from "next";

/**
 * SUTA PASS — application Android.
 *
 * `output: "export"` produit un site entièrement statique dans `out/`, que
 * Capacitor empaquette dans l'APK. C'est une contrainte, et elle est
 * structurante : une application empaquetée n'a PAS de serveur Next à sa
 * disposition. Aucune route d'API, aucun composant serveur, aucune variable
 * d'environnement serveur ne peut être utilisée ici.
 *
 * C'est exactement ce qu'on veut pour PASS : tout ce que fait l'application
 * doit fonctionner sans réseau, et `@suta/pass` est un module pur qui tourne
 * dans la WebView aussi bien que dans un test Node.
 */
const nextConfig: NextConfig = {
  output: "export",
  // Les images distantes ne sont pas optimisables sans serveur ; PASS n'en
  // affiche pas, mais la consigne évite un échec de build si l'on en ajoute.
  images: { unoptimized: true },
};

export default nextConfig;
