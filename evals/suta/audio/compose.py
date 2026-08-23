#!/usr/bin/env python3
"""Composition des scénarios audio du banc vocal SUTA — stdlib uniquement.

Le faux micro Chromium (`--use-file-for-fake-audio-capture`) ne lit QU'UN SEUL
fichier par lancement de navigateur : chaque scénario doit donc être un unique
WAV qui embarque question + pauses + bruit, dans l'ordre. Cet utilitaire
concatène des morceaux pour fabriquer ce fichier.

Usage :
  python3 compose.py <sortie.wav> <morceau> [<morceau> ...]

Un <morceau> est :
  - un chemin vers un WAV existant (PCM 16 bits, mono, 24 000 Hz) ;
  - ou `silence:<ms>` pour insérer un silence exact (ex. `silence:1500`).

Exemples (une fois les WAV de parole enregistrés — voir README.md) :
  python3 compose.py scenarios/v-bruit-tv.wav \
      silence:1500 pass.wav silence:12000 background-tv.wav silence:5000

RÈGLE STRICTE : aucun resampling, aucune conversion. Toute entrée qui n'est pas
exactement du PCM 16 bits / mono / 24 000 Hz est REJETÉE avec une erreur —
un rééchantillonnage naïf fausserait le stimulus et donc la comparaison entre
deux commits. Réenregistrez ou convertissez le fichier en amont (hors banc).
"""

import os
import sys
import wave

SAMPLE_RATE = 24_000
CHANNELS = 1
SAMPLE_WIDTH = 2  # 16 bits


def read_pcm(path: str) -> bytes:
    with wave.open(path, "rb") as wav:
        problems = []
        if wav.getnchannels() != CHANNELS:
            problems.append(f"{wav.getnchannels()} canaux (attendu : mono)")
        if wav.getsampwidth() != SAMPLE_WIDTH:
            problems.append(f"{8 * wav.getsampwidth()} bits (attendu : 16 bits)")
        if wav.getframerate() != SAMPLE_RATE:
            problems.append(f"{wav.getframerate()} Hz (attendu : {SAMPLE_RATE} Hz)")
        if wav.getcomptype() != "NONE":
            problems.append(f"compression {wav.getcomptype()} (attendu : PCM)")
        if problems:
            raise SystemExit(
                f"ERREUR : {path} n'est pas au format du banc — "
                + " ; ".join(problems)
                + ". Aucun resampling automatique : convertissez le fichier en amont."
            )
        return wav.readframes(wav.getnframes())


def silence_pcm(ms: int) -> bytes:
    frames = round(ms * SAMPLE_RATE / 1000)
    return b"\x00" * (frames * SAMPLE_WIDTH)


def main(argv: list[str]) -> None:
    if len(argv) < 3:
        raise SystemExit(__doc__)
    out_path, parts = argv[1], argv[2:]
    chunks: list[bytes] = []
    for part in parts:
        if part.startswith("silence:"):
            try:
                ms = int(part.split(":", 1)[1])
            except ValueError:
                raise SystemExit(f"ERREUR : durée de silence illisible : {part}")
            chunks.append(silence_pcm(ms))
        else:
            if not os.path.isfile(part):
                raise SystemExit(f"ERREUR : fichier introuvable : {part}")
            chunks.append(read_pcm(part))
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with wave.open(out_path, "wb") as out:
        out.setnchannels(CHANNELS)
        out.setsampwidth(SAMPLE_WIDTH)
        out.setframerate(SAMPLE_RATE)
        out.writeframes(b"".join(chunks))
    total = sum(len(c) for c in chunks) // SAMPLE_WIDTH
    print(f"écrit : {out_path} ({total / SAMPLE_RATE:.1f} s)")


if __name__ == "__main__":
    main(sys.argv)
