"""
PLANORA — Dataset Builder
Télécharge et prépare le dataset de plans architecturaux pour RAG.
Utilise des plans synthétiques réalistes si RPLAN n'est pas disponible.
"""

import json
import math
import random
import os

DATA_PATH = "data/plans_dataset.json"


def generate_realistic_plan(surface, chambres, sdb, style, seed=None):
    """Génère un plan réaliste annoté — simule un vrai plan architectural."""
    if seed is not None:
        random.seed(seed)

    rooms = []

    # Règles architecturales réelles par style
    style_rules = {
        "moderne": {
            "salon_ratio": 0.22, "cuisine_ratio": 0.10,
            "ch_ratio": 0.38, "sdb_ratio": 0.10,
            "open_kitchen": True, "patio": False,
            "orientation_salon": "sud", "couloir_min": 1.2
        },
        "marocain": {
            "salon_ratio": 0.28, "cuisine_ratio": 0.10,
            "ch_ratio": 0.32, "sdb_ratio": 0.08,
            "open_kitchen": False, "patio": True,
            "orientation_salon": "nord", "couloir_min": 1.5
        },
        "traditionnel": {
            "salon_ratio": 0.26, "cuisine_ratio": 0.12,
            "ch_ratio": 0.34, "sdb_ratio": 0.08,
            "open_kitchen": False, "patio": False,
            "orientation_salon": "est", "couloir_min": 1.2
        },
        "minimaliste": {
            "salon_ratio": 0.20, "cuisine_ratio": 0.09,
            "ch_ratio": 0.42, "sdb_ratio": 0.10,
            "open_kitchen": True, "patio": False,
            "orientation_salon": "sud", "couloir_min": 1.0
        },
    }

    rules = style_rules.get(style, style_rules["moderne"])

    # Surfaces calculées selon règles réelles
    salon_s = surface * rules["salon_ratio"]
    cuisine_s = surface * rules["cuisine_ratio"]
    ch_total = surface * rules["ch_ratio"]
    sdb_total = surface * rules["sdb_ratio"]

    # Chambre principale plus grande (règle architecturale)
    ch_principale = ch_total * 0.40
    ch_secondaires = (ch_total * 0.60) / max(chambres - 1, 1)

    # Contraintes minimales normes marocaines
    salon_s = max(salon_s, 20)
    cuisine_s = max(cuisine_s, 9)
    ch_principale = max(ch_principale, 12)
    ch_secondaires = max(ch_secondaires, 9)
    sdb_s = max(sdb_total / sdb, 4)

    # Layout intelligent selon surface
    if surface <= 80:
        layout = "compact"
    elif surface <= 120:
        layout = random.choice(["horizontal", "L-shape"])
    else:
        layout = random.choice(["L-shape", "U-shape", "cour"])

    # Placement des pièces selon layout
    cursor_x, cursor_y = 0, 0

    def dims(surface_m2, ratio=1.3):
        w = max(3, round(math.sqrt(surface_m2 * ratio)))
        h = max(2, round(surface_m2 / w))
        return w, h

    # === ZONE JOUR ===
    sw, sh = dims(salon_s, 1.4)
    rooms.append({
        "name": "Salon", "x": cursor_x, "y": cursor_y,
        "w": sw, "h": sh, "type": "living",
        "surface_m2": sw * sh,
        "orientation": rules["orientation_salon"],
        "adjacencies": ["Cuisine", "Couloir"]
    })

    if rules["open_kitchen"]:
        # Cuisine ouverte sur salon (moderne/minimaliste)
        cw, ch_d = dims(cuisine_s, 1.0)
        rooms.append({
            "name": "Cuisine", "x": sw, "y": cursor_y,
            "w": cw, "h": ch_d, "type": "kitchen",
            "surface_m2": cw * ch_d,
            "orientation": "nord",
            "adjacencies": ["Salon", "Couloir"]
        })
        zone_jour_w = sw + cw
        zone_jour_h = max(sh, ch_d)
    else:
        # Cuisine fermée
        cw, ch_d = dims(cuisine_s, 1.2)
        rooms.append({
            "name": "Cuisine", "x": 0, "y": sh,
            "w": cw, "h": ch_d, "type": "kitchen",
            "surface_m2": cw * ch_d,
            "orientation": "nord",
            "adjacencies": ["Couloir"]
        })
        zone_jour_w = max(sw, cw)
        zone_jour_h = sh + ch_d

    # Patio marocain
    if rules["patio"] and surface >= 120:
        patio_w = max(3, round(math.sqrt(surface * 0.08)))
        patio_h = patio_w
        rooms.append({
            "name": "Patio", "x": zone_jour_w, "y": 0,
            "w": patio_w, "h": patio_h, "type": "patio",
            "surface_m2": patio_w * patio_h,
            "orientation": "centre",
            "adjacencies": ["Salon", "Couloir"]
        })
        zone_jour_w += patio_w

    # === COULOIR ===
    couloir_y = zone_jour_h
    rooms.append({
        "name": "Couloir", "x": 0, "y": couloir_y,
        "w": zone_jour_w, "h": 2, "type": "corridor",
        "surface_m2": zone_jour_w * 2,
        "orientation": "central",
        "adjacencies": ["toutes pièces"]
    })

    # === ZONE NUIT ===
    nuit_y = couloir_y + 2
    ch_x = 0

    # Chambre principale
    pw, ph = dims(ch_principale, 1.2)
    rooms.append({
        "name": "Chambre principale", "x": ch_x, "y": nuit_y,
        "w": pw, "h": ph, "type": "bedroom",
        "surface_m2": pw * ph,
        "orientation": "sud",
        "adjacencies": ["SDB 1", "Couloir", "Dressing"]
    })
    ch_x += pw

    # Chambres secondaires
    for i in range(max(chambres - 1, 0)):
        w2, h2 = dims(ch_secondaires, 1.1)
        rooms.append({
            "name": f"Chambre {i + 2}", "x": ch_x, "y": nuit_y,
            "w": w2, "h": h2, "type": "bedroom",
            "surface_m2": w2 * h2,
            "orientation": "nord",
            "adjacencies": [f"SDB {min(i+2, sdb)}", "Couloir"]
        })
        ch_x += w2

    # Dressing si surface suffisante
    if surface >= 100 and chambres >= 2:
        rooms.append({
            "name": "Dressing", "x": ch_x, "y": nuit_y,
            "w": 2, "h": ph, "type": "dressing",
            "surface_m2": 2 * ph,
            "orientation": "intérieur",
            "adjacencies": ["Chambre principale"]
        })
        ch_x += 2

    # Salles de bain
    sdb_y = nuit_y + ph + 1
    sdb_x = 0
    for i in range(sdb):
        sw2, sh2 = dims(sdb_s, 0.9)
        rooms.append({
            "name": "SDB" if sdb == 1 else f"SDB {i + 1}",
            "x": sdb_x, "y": sdb_y,
            "w": sw2, "h": sh2, "type": "bathroom",
            "surface_m2": sw2 * sh2,
            "orientation": "intérieur",
            "adjacencies": [f"Chambre {i + 1}" if i > 0 else "Chambre principale"]
        })
        sdb_x += sw2 + 1

    # Calcul score qualité du plan
    quality_score = _compute_quality_score(rooms, rules, surface)

    return {
        "surface": surface,
        "chambres": chambres,
        "sdb": sdb,
        "style": style,
        "layout": layout,
        "rooms": rooms,
        "rules_applied": rules,
        "quality_score": quality_score,
        "total_rooms_surface": sum(r["surface_m2"] for r in rooms)
    }


def _compute_quality_score(rooms, rules, surface):
    """Score qualité 0-100 basé sur règles architecturales."""
    score = 100

    room_types = {r["type"] for r in rooms}

    # Pénalités
    if "living" not in room_types:
        score -= 20
    if "kitchen" not in room_types:
        score -= 15
    if "bedroom" not in room_types:
        score -= 20
    if "bathroom" not in room_types:
        score -= 15

    # Bonus adjacences respectées
    salon = next((r for r in rooms if r["type"] == "living"), None)
    cuisine = next((r for r in rooms if r["type"] == "kitchen"), None)
    if salon and cuisine:
        dist = abs(salon["x"] - cuisine["x"]) + abs(salon["y"] - cuisine["y"])
        if dist <= 2:
            score += 5  # bonus cuisine proche salon

    return min(100, max(0, score))


def build_dataset(n_plans=500):
    """Construit un dataset de N plans variés et réalistes."""
    print(f"Construction du dataset ({n_plans} plans)...")

    os.makedirs("data", exist_ok=True)
    plans = []

    styles = ["moderne", "marocain", "traditionnel", "minimaliste"]
    surfaces = [60, 70, 80, 90, 100, 110, 120, 140, 160, 200]
    chambres_options = [1, 2, 3, 4, 5]
    sdb_options = [1, 2, 3]

    for i in range(n_plans):
        surface = random.choice(surfaces) + random.randint(-10, 10)
        surface = max(40, surface)
        chambres = random.choice(chambres_options)
        sdb = min(random.choice(sdb_options), chambres)
        style = random.choice(styles)

        plan = generate_realistic_plan(surface, chambres, sdb, style, seed=i)
        plans.append(plan)

        if (i + 1) % 100 == 0:
            print(f"  {i + 1}/{n_plans} plans générés...")

    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(plans, f, ensure_ascii=False, indent=2)

    print(f"Dataset sauvegardé: {DATA_PATH} ({len(plans)} plans)")
    return plans


if __name__ == "__main__":
    plans = build_dataset(500)
    print(f"\nExemple de plan:")
    p = plans[0]
    print(f"  Style: {p['style']}, Surface: {p['surface']}m², Layout: {p['layout']}")
    print(f"  Pièces: {[r['name'] for r in p['rooms']]}")
    print(f"  Score qualité: {p['quality_score']}/100")