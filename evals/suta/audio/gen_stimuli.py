#!/usr/bin/env python3
"""Génération des stimuli SYNTHÉTIQUES du banc vocal SUTA (spec docs/vocal-qa-agent.md).

Stdlib uniquement (wave + struct + math). Sortie DÉTERMINISTE : un PRNG maison
(LCG) à graine fixe — deux exécutions, sur deux machines, produisent des
fichiers identiques octet pour octet. C'est la condition pour que deux commits
reçoivent exactement la même entrée audio.

Fichiers produits (dans ce dossier) :
  - silence-30s.wav     : 30 s de zéros. Vérifie qu'aucun tour fantôme
                          n'apparaît après une réponse (V-SILENCE-30S).
  - background-tv.wav   : 15 s de « babble » synthétique — somme de bandes de
                          bruit filtré (registres voisins des formants de la
                          parole) modulées à un rythme syllabique lent. Cela
                          ressemble ÉNERGÉTIQUEMENT à une télévision lointaine
                          sans contenir aucune parole réelle (V-BRUIT-TV).

Format : WAV PCM 16 bits, mono, 24 000 Hz — le format exigé par compose.py et
par le faux micro Chromium du runner.

Usage :  python3 evals/suta/audio/gen_stimuli.py
"""

import math
import os
import struct
import wave

SAMPLE_RATE = 24_000
HERE = os.path.dirname(os.path.abspath(__file__))


class Lcg:
    """PRNG déterministe (Numerical Recipes) — indépendant de la version Python."""

    def __init__(self, seed: int) -> None:
        self.state = seed & 0xFFFFFFFF

    def next_float(self) -> float:
        """Uniforme dans [-1, 1)."""
        self.state = (1664525 * self.state + 1013904223) & 0xFFFFFFFF
        return (self.state / 2147483648.0) - 1.0


class Biquad:
    """Filtre passe-bande biquad (RBJ cookbook), état interne minimal."""

    def __init__(self, center_hz: float, q: float) -> None:
        w0 = 2.0 * math.pi * center_hz / SAMPLE_RATE
        alpha = math.sin(w0) / (2.0 * q)
        b0 = alpha
        b1 = 0.0
        b2 = -alpha
        a0 = 1.0 + alpha
        a1 = -2.0 * math.cos(w0)
        a2 = 1.0 - alpha
        self.b0, self.b1, self.b2 = b0 / a0, b1 / a0, b2 / a0
        self.a1, self.a2 = a1 / a0, a2 / a0
        self.x1 = self.x2 = self.y1 = self.y2 = 0.0

    def process(self, x: float) -> float:
        y = (
            self.b0 * x
            + self.b1 * self.x1
            + self.b2 * self.x2
            - self.a1 * self.y1
            - self.a2 * self.y2
        )
        self.x2, self.x1 = self.x1, x
        self.y2, self.y1 = self.y1, y
        return y


def write_wav(path: str, samples) -> None:
    with wave.open(path, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(SAMPLE_RATE)
        clamped = (max(-32768, min(32767, int(s * 32767.0))) for s in samples)
        out.writeframes(b"".join(struct.pack("<h", s) for s in clamped))


def gen_silence(seconds: float):
    return (0.0 for _ in range(int(seconds * SAMPLE_RATE)))


def gen_background_tv(seconds: float):
    """Babble TV lointain : 3 bandes de bruit filtré, modulation syllabique.

    - Bandes centrées sur 300 / 900 / 2200 Hz (énergie répartie comme de la
      parole, sans structure linguistique).
    - Modulation lente ~3-5 Hz (rythme syllabique) + enveloppe très lente qui
      simule les alternances de « scènes » télé.
    - Niveau crête ≈ -18 dBFS : audible par un VAD sensible, clairement plus
      faible qu'une vraie prise de parole au premier plan.
    """
    rng = Lcg(0x5074BA)  # graine fixe — NE PAS changer sans re-versionner
    bands = [
        (Biquad(300.0, 2.0), 1.00, 3.1, 0.00),
        (Biquad(900.0, 2.5), 0.80, 4.3, 1.30),
        (Biquad(2200.0, 3.0), 0.45, 5.0, 2.60),
    ]
    total = int(seconds * SAMPLE_RATE)
    for i in range(total):
        t = i / SAMPLE_RATE
        # Alternance lente de « scènes » (8 s) : la télé n'est pas constante.
        scene = 0.55 + 0.45 * math.sin(2.0 * math.pi * t / 8.0 + 0.7)
        x = 0.0
        for filt, gain, syll_hz, phase in bands:
            noise = rng.next_float()
            syllabic = 0.5 + 0.5 * math.sin(2.0 * math.pi * syll_hz * t + phase)
            x += filt.process(noise) * gain * (syllabic ** 2)
        yield x * scene * 0.24  # crête ≈ 0.12-0.13 → ~ -18 dBFS


def main() -> None:
    targets = [
        ("silence-30s.wav", gen_silence(30.0)),
        ("background-tv.wav", gen_background_tv(15.0)),
    ]
    for name, samples in targets:
        path = os.path.join(HERE, name)
        write_wav(path, samples)
        print(f"écrit : {path} ({os.path.getsize(path)} octets)")


if __name__ == "__main__":
    main()
