import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ci.ansut.suta.pass",
  appName: "SUTA PASS",
  // `out/` est la sortie de `next build` avec output: "export".
  webDir: "out",
  android: {
    // Le lot 2 ne signe qu'en debug (arbitrage du 17/09) : aucun keystore de
    // production n'entre dans ce dépôt.
    buildOptions: {},
  },
};

export default config;
