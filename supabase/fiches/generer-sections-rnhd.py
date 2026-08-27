"""Génère `sections-rnhd-mai-2026.json` depuis la liste interne des sections
du RNHD mises à disposition des opérateurs (xlsx DDIR, mise à jour mai 2026).

Le fichier SOURCE ne se verse jamais dans ce dépôt public. Les colonnes
« DATE DE MAD » par opérateur et les mentions d'intention (négociations
commerciales en cours) sont VOLONTAIREMENT ignorées : les fiches disent le
statut du tronçon, jamais qui l'exploite ni qui le négocie.

Usage :
    pip install openpyxl
    python3 supabase/fiches/generer-sections-rnhd.py <liste-sections.xlsx>

Puis chargement par le circuit normal (supabase/README.md) : load-fiches
(url raw.githubusercontent du JSON) puis embed-chunks jusqu'à remaining=0.
"""

import json
import re
import sys
from pathlib import Path

import openpyxl

DATE_DONNEES = "mai 2026"

GARDE = (
    "Une section exploitée ne veut pas dire que chaque village traversé a la fibre "
    "chez lui : la dorsale transporte le réseau entre les villes, et l'accès local "
    "dépend des raccordements réalisés autour de chaque localité."
)


def nom_propre(brut):
    return re.sub(
        r"[A-Za-zÀ-ÖØ-öø-ÿ]+",
        lambda m: m.group(0)[:1].upper() + m.group(0)[1:].lower(),
        str(brut).strip(),
    )


def fr_km(v):
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    texte = f"{n:.1f}".rstrip("0").rstrip(".")
    return texte.replace(".", ",")


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    wb = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
    ws = wb["Feuil1"]
    lignes = list(ws.iter_rows(min_row=3, values_only=True))

    fiches = []
    vus = {}
    total = exploites = 0
    km_total = km_exploites = 0.0
    for ligne in lignes:
        ident, designation, lineaire, statut = ligne[2], ligne[3], ligne[4], ligne[5]
        if not ident or not designation:
            continue
        statut = str(statut or "").strip().upper()
        if statut not in ("EXPLOITE", "NON EXPLOITE"):
            continue
        nom = nom_propre(designation)
        km = fr_km(lineaire)
        total += 1
        try:
            km_total += float(lineaire)
        except (TypeError, ValueError):
            pass
        base_id = re.sub(r"[^a-z0-9]+", "-", str(ident).lower()).strip("-")
        vus[base_id] = vus.get(base_id, 0) + 1
        fiche_id = f"rnhd-sec-{base_id}" + (f"-{vus[base_id]}" if vus[base_id] > 1 else "")

        if statut == "EXPLOITE":
            exploites += 1
            try:
                km_exploites += float(lineaire)
            except (TypeError, ValueError):
                pass
            etat = (
                "cette section est en exploitation : la fibre y est posée et le tronçon "
                "est utilisé pour transporter le trafic."
            )
        else:
            etat = (
                "la fibre de cette section est posée, mais le tronçon n'est pas encore "
                "exploité — il est disponible et attend d'être mis en service."
            )
        longueur = f"Elle mesure environ {km} kilomètres. " if km else ""
        fiches.append({
            "id": fiche_id,
            "title": f"RNHD — section {nom}",
            "content": (
                f"La section {nom} fait partie du Réseau National Haut Débit (RNHD), la "
                f"dorsale de fibre optique de l'État de Côte d'Ivoire. {longueur}"
                f"À la date de {DATE_DONNEES}, {etat} {GARDE}"
            ),
            "visibility": "PUBLIC",
            "region": None,
            "metadata": {
                "theme": "RNHD — dorsale nationale de fibre optique",
                "statut": "en exploitation" if statut == "EXPLOITE" else "posée, non exploitée",
                "date_donnees": "2026-05",
            },
        })

    synthese = {
        "id": "rnhd-synthese-2026-05",
        "title": "Le RNHD en mai 2026 : l'état réel de la dorsale de fibre optique",
        "content": (
            "Le Réseau National Haut Débit (RNHD) est la dorsale de fibre optique de l'État "
            "de Côte d'Ivoire : elle relie les villes du pays entre elles et transporte "
            "l'internet à haut débit que les opérateurs distribuent ensuite localement. "
            f"Selon la liste des sections mise à jour en {DATE_DONNEES}, le réseau compte "
            f"{total} sections recensées, totalisant environ {round(km_total)} kilomètres de "
            f"fibre posée. {exploites} sections, soit environ {round(km_exploites)} kilomètres, "
            f"sont en exploitation ; les {total - exploites} autres, environ "
            f"{round(km_total - km_exploites)} kilomètres, sont posées mais pas encore "
            "exploitées — une réserve de capacité prête à être mise en service. Le RNHD est "
            "mis à la disposition des opérateurs de télécommunications, qui s'y raccordent "
            f"pour desservir leurs clients. {GARDE}"
        ),
        "visibility": "PUBLIC",
        "region": None,
        "metadata": {
            "theme": "RNHD — dorsale nationale de fibre optique",
            "statut": "synthèse",
            "date_donnees": "2026-05",
        },
    }

    sortie = Path(__file__).parent / "sections-rnhd-mai-2026.json"
    sortie.write_text(json.dumps([synthese] + fiches, ensure_ascii=False, indent=1), encoding="utf-8")
    print(
        f"{len(fiches)} sections + 1 synthèse -> {sortie} — "
        f"{exploites} exploitées ({km_exploites:.0f} km) / {total - exploites} non exploitées "
        f"({km_total - km_exploites:.0f} km), total {km_total:.0f} km"
    )


if __name__ == "__main__":
    main()
