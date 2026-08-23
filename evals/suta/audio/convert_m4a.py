"""Convertit un enregistrement de parole (m4a du téléphone) en éprouvette du
banc vocal : PCM 16 bits mono 24 kHz, nettoyé pour le VAD serveur.

Leçons du run réel n°4 (23/08) — un enregistrement de téléphone contient :

1. des BRUITS ISOLÉS en tête (claquement du bouton, souffle) suivis d'un long
   silence : le VAD ouvrait un tour sur le bruit, Whisper hallucinait
   (« Sous-titres réalisés par… », « Au revoir. ») et le scénario gagnait un
   tour utilisateur fantôme AVANT la vraie question ;
2. des PAUSES INTERNES de plus de 600 ms : pile au-dessus du
   `silence_duration_ms` du VAD serveur, la phrase se coupait en deux tours.

Nettoyage appliqué, dans l'ordre :
- segmentation par énergie (RMS sur fenêtres de 50 ms, seuil à 12 % du max) ;
- fusion en groupes de mots (un trou < 300 ms fait partie de la phrase —
  sans cette fusion, « Je suis à » devenait trois « bruits » à supprimer) ;
- suppression des groupes de tête/queue à la fois COURTS (< 250 ms) et
  ISOLÉS (à ≥ 400 ms du reste) : un claquement est bref et loin de la
  phrase ; une syllabe douce est brève mais collée à la suite ;
- compression des silences INTERNES à 400 ms maximum (sous le seuil de
  clôture de tour du VAD — la pause reste naturelle à l'oreille) ;
- gardes de 300 ms de silence numérique en tête et en queue.

Usage :
    pip install av numpy
    python3 convert_m4a.py <entrée.m4a> <sortie.wav> [...]
"""

import sys
import wave

import av
import numpy as np

RATE = 24_000
PAD_MS = 300
WIN_MS = 50
SEGMENT_RMS_THRESHOLD = 0.12   # fraction du RMS max
MIN_EDGE_SEGMENT_MS = 250      # en deçà : bruit isolé si en tête/queue
MAX_INTERNAL_SILENCE_MS = 400  # < silence_duration_ms du VAD serveur (600)


def decode(src):
    container = av.open(src)
    resampler = av.AudioResampler(format="s16", layout="mono", rate=RATE)
    chunks = []
    for frame in container.decode(audio=0):
        for out in resampler.resample(frame):
            chunks.append(out.to_ndarray().reshape(-1))
    for out in resampler.resample(None):
        chunks.append(out.to_ndarray().reshape(-1))
    return np.concatenate(chunks).astype(np.int16)


def segments_actifs(pcm):
    """[(début_fenêtre, fin_fenêtre exclusive), ...] au-dessus du seuil RMS."""
    win = RATE * WIN_MS // 1000
    n = len(pcm) // win
    rms = np.sqrt((pcm[: n * win].astype(np.float64).reshape(n, win) ** 2).mean(axis=1))
    active = rms > rms.max() * SEGMENT_RMS_THRESHOLD
    segs = []
    start = None
    for i, on in enumerate(active):
        if on and start is None:
            start = i
        elif not on and start is not None:
            segs.append((start, i))
            start = None
    if start is not None:
        segs.append((start, len(active)))
    return segs, win


def convert(src, dst):
    pcm = decode(src)
    if not len(pcm) or np.abs(pcm).max() == 0:
        raise SystemExit(f"{src}: silence total")
    raw, win = segments_actifs(pcm)
    if not raw:
        raise SystemExit(f"{src}: aucune parole détectée")

    # Fusion en groupes de mots : un trou < 300 ms fait partie de la phrase.
    segs = []
    for a, b in raw:
        if segs and (a - segs[-1][1]) * WIN_MS < 300:
            segs[-1][1] = b
        else:
            segs.append([a, b])

    # Bruits isolés en tête/queue : groupe court ET loin du reste.
    def est_bruit(groupe, gap_ms):
        return (groupe[1] - groupe[0]) * WIN_MS < MIN_EDGE_SEGMENT_MS and gap_ms >= 400

    dropped = []
    while len(segs) > 1 and est_bruit(segs[0], (segs[1][0] - segs[0][1]) * WIN_MS):
        dropped.append(("tête", segs.pop(0)))
    while len(segs) > 1 and est_bruit(segs[-1], (segs[-1][0] - segs[-2][1]) * WIN_MS):
        dropped.append(("queue", segs.pop(-1)))

    # Reconstruction : segments actifs + silences internes compressés.
    max_gap = MAX_INTERNAL_SILENCE_MS * RATE // 1000
    parts = []
    for k, (a, b) in enumerate(segs):
        if k > 0:
            gap = (a - segs[k - 1][1]) * win
            parts.append(np.zeros(min(gap, max_gap), dtype=np.int16))
        parts.append(pcm[a * win : b * win])
    pad = np.zeros(RATE * PAD_MS // 1000, dtype=np.int16)
    out = np.concatenate([pad, *parts, pad])

    with wave.open(dst, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(out.tobytes())
    notes = "".join(f" ; bruit isolé retiré ({side}, {(b - a) * WIN_MS} ms)" for side, (a, b) in dropped)
    print(f"{dst}: {len(out) / RATE:.2f}s{notes}")


if __name__ == "__main__":
    if len(sys.argv) < 3 or len(sys.argv) % 2 == 0:
        raise SystemExit(__doc__)
    for src, dst in zip(sys.argv[1::2], sys.argv[2::2]):
        convert(src, dst)
