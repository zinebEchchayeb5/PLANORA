import math
import random

WALL_THICKNESS = 0.20
DOOR_WIDTH = 0.90
DOOR_WIDTH_MAIN = 1.00
WINDOW_WIDTH = 1.20
WINDOW_HEIGHT_FROM_FLOOR = 0.90
CEILING_HEIGHT = 2.80

SURFACES_MIN = {
    "salon": 20, "cuisine": 9, "chambre_principale": 14,
    "chambre": 10, "sdb": 4, "wc": 1.5, "couloir": 0,
    "garage": 16, "entree": 3, "dressing": 4,
}

ROOM_CONFIGS = {
    "maison": {
        "moderne":      {"salon":0.20,"cuisine":0.10,"ch":0.35,"sdb":0.08,"couloir":0.05,"garage":0.10,"entree":0.03},
        "traditionnel": {"salon":0.25,"cuisine":0.10,"ch":0.33,"sdb":0.07,"couloir":0.05,"garage":0.08,"entree":0.03},
        "marocain":     {"salon":0.28,"cuisine":0.09,"ch":0.30,"sdb":0.07,"couloir":0.06,"garage":0.08,"entree":0.03},
        "minimaliste":  {"salon":0.20,"cuisine":0.10,"ch":0.38,"sdb":0.08,"couloir":0.04,"garage":0.10,"entree":0.03},
    },
    "villa": {
        "moderne":      {"salon":0.18,"cuisine":0.09,"ch":0.30,"sdb":0.07,"couloir":0.04,"garage":0.12,"entree":0.04},
        "marocain":     {"salon":0.25,"cuisine":0.08,"ch":0.27,"sdb":0.06,"couloir":0.04,"garage":0.10,"entree":0.04},
        "traditionnel": {"salon":0.22,"cuisine":0.09,"ch":0.28,"sdb":0.06,"couloir":0.05,"garage":0.10,"entree":0.04},
        "minimaliste":  {"salon":0.18,"cuisine":0.09,"ch":0.33,"sdb":0.07,"couloir":0.03,"garage":0.12,"entree":0.03},
    },
    "appartement": {
        "moderne":      {"salon":0.25,"cuisine":0.12,"ch":0.40,"sdb":0.10,"couloir":0.08,"garage":0,"entree":0.05},
        "traditionnel": {"salon":0.28,"cuisine":0.12,"ch":0.38,"sdb":0.09,"couloir":0.08,"garage":0,"entree":0.05},
        "marocain":     {"salon":0.30,"cuisine":0.11,"ch":0.36,"sdb":0.09,"couloir":0.09,"garage":0,"entree":0.05},
        "minimaliste":  {"salon":0.23,"cuisine":0.12,"ch":0.42,"sdb":0.10,"couloir":0.08,"garage":0,"entree":0.05},
    }
}

CONTEXT_RULES = {
    "sur_rue":       {"recul_avant":3.0,"recul_lateral":1.5,"recul_arriere":2.0,"cloture":True},
    "milieu_urbain": {"recul_avant":2.0,"recul_lateral":0.0,"recul_arriere":1.0,"cloture":True},
    "residentiel":   {"recul_avant":5.0,"recul_lateral":3.0,"recul_arriere":4.0,"cloture":True},
}

MOBILIER = {
    "living":   [{"name":"Canapé","w":2.4,"h":0.9,"color":"#C8B89A"},{"name":"Table basse","w":1.1,"h":0.6,"color":"#B09070"},{"name":"TV","w":1.4,"h":0.1,"color":"#333333"},{"name":"Fauteuil","w":0.9,"h":0.9,"color":"#C8B89A"}],
    "kitchen":  [{"name":"Plan travail","w":2.4,"h":0.60,"color":"#E0D0C0"},{"name":"Frigo","w":0.65,"h":0.65,"color":"#D0D0D0"},{"name":"Évier","w":0.80,"h":0.55,"color":"#A0C0D0"},{"name":"Cuisinière","w":0.60,"h":0.60,"color":"#C0C0C0"}],
    "bedroom":  [{"name":"Lit 160","w":1.70,"h":2.10,"color":"#D4C4B0"},{"name":"Table nuit","w":0.50,"h":0.45,"color":"#C0A888"},{"name":"Armoire","w":1.80,"h":0.60,"color":"#B89870"}],
    "bedroom_s":[{"name":"Lit 120","w":1.30,"h":2.00,"color":"#D4C4B0"},{"name":"Bureau","w":1.20,"h":0.60,"color":"#C0A888"},{"name":"Armoire","w":1.20,"h":0.55,"color":"#B89870"}],
    "bathroom": [{"name":"Baignoire","w":1.70,"h":0.75,"color":"#B0D4E0"},{"name":"WC","w":0.38,"h":0.65,"color":"#E0E0E0"},{"name":"Lavabo","w":0.65,"h":0.50,"color":"#D0E8F0"},{"name":"Douche","w":0.90,"h":0.90,"color":"#C0D8E8"}],
    "garage":   [{"name":"Véhicule","w":2.5,"h":5.0,"color":"#C0C0B0"}],
    "dressing": [{"name":"Penderie","w":1.80,"h":0.55,"color":"#C0A878"},{"name":"Penderie","w":1.80,"h":0.55,"color":"#C0A878"}],
}

def snap(val, grid=0.05):
    return round(round(val / grid) * grid, 2)

def dims_from_surface(surface, ratio=1.3, min_w=2.5, min_h=2.5):
    w = snap(math.sqrt(surface * ratio))
    h = snap(surface / max(w, 0.1))
    return max(w, min_w), max(h, min_h)

def generate_plan(surface: int, chambres: int, sdb: int, style: str,
                  type_bien: str = "maison", contexte: str = "sur_rue") -> dict:
    cfg = ROOM_CONFIGS.get(type_bien, ROOM_CONFIGS["maison"]).get(style, ROOM_CONFIGS["maison"]["moderne"])
    ctx_rules = CONTEXT_RULES.get(contexte, CONTEXT_RULES["sur_rue"])
    
    # Choix du layout parmi plusieurs types
    layout_type = random.choice(["compact", "couloir_central", "L", "U", "profondeur"])
    # Pour appartement, on évite U et parfois L
    if type_bien == "appartement":
        layout_type = random.choice(["compact", "couloir_central", "profondeur"])
    # Pour villa, on favorise U et L
    if type_bien == "villa":
        layout_type = random.choice(["L", "U", "compact", "couloir_central", "profondeur"])
    
    # Calcul des surfaces
    s_entree  = snap(max(surface * cfg.get("entree", 0.03), SURFACES_MIN["entree"]))
    s_salon   = snap(max(surface * cfg["salon"],   SURFACES_MIN["salon"]))
    s_cuisine = snap(max(surface * cfg["cuisine"], SURFACES_MIN["cuisine"]))
    s_couloir = snap(surface * cfg["couloir"])
    s_garage  = snap(surface * cfg["garage"]) if type_bien != "appartement" else 0
    s_ch_total = surface * cfg["ch"]
    s_sdb_total = surface * cfg["sdb"]
    
    s_ch_principale = snap(max(s_ch_total * 0.40, SURFACES_MIN["chambre_principale"]))
    s_ch_sec = snap(max((s_ch_total - s_ch_principale) / max(chambres - 1, 1), SURFACES_MIN["chambre"])) if chambres > 1 else 0
    s_sdb_principale = snap(max(s_sdb_total * 0.55, SURFACES_MIN["sdb"]))
    s_sdb_sec = snap(max((s_sdb_total - s_sdb_principale) / max(sdb - 1, 1), SURFACES_MIN["sdb"])) if sdb > 1 else 0
    
    # Dimensions des pièces
    ew, eh = dims_from_surface(s_entree, 1.5, 1.5, 1.5)
    sw, sh = dims_from_surface(s_salon, 1.4, 4.0, 3.5)
    cw, ch = dims_from_surface(s_cuisine, 1.2, 3.0, 2.5)
    bpw, bph = dims_from_surface(s_ch_principale, 1.2, 3.5, 3.0)
    bsw, bsh = dims_from_surface(s_ch_sec, 1.1, 3.0, 2.8) if chambres > 1 else (0, 0)
    sdbpw, sdbph = dims_from_surface(s_sdb_principale, 0.9, 2.0, 2.0)
    sdbsw, sdbsh = dims_from_surface(s_sdb_sec, 0.9, 1.8, 1.8) if sdb > 1 else (0, 0)
    gw, gh = (3.0, 5.5) if s_garage > 0 else (0, 0)
    
    rooms = []
    doors = []
    windows = []
    furniture = []
    
    # Variables pour les dimensions globales
    max_x = 0
    max_y = 0
    
    # Construction selon le layout
    if layout_type == "compact":
        # Disposition linéaire : entrée, salon, cuisine en façade, chambres derrière
        cur_x, cur_y = 0.0, 0.0
        rooms.append({"name":"Entrée","x":snap(cur_x),"y":snap(cur_y),"w":snap(ew),"h":snap(eh),"type":"corridor"})
        salon_x = snap(cur_x + ew)
        rooms.append({"name":"Salon","x":salon_x,"y":snap(cur_y),"w":snap(sw),"h":snap(sh),"type":"living"})
        cuisine_x = snap(salon_x + sw)
        rooms.append({"name":"Cuisine","x":cuisine_x,"y":snap(cur_y),"w":snap(cw),"h":snap(ch),"type":"kitchen"})
        zone_w = snap(ew + sw + cw)
        zone_h = snap(max(sh, ch, eh))
        # Couloir arrière
        couloir_y = snap(zone_h + 0.2)
        couloir_w = snap(zone_w)
        couloir_h = snap(max(1.2, s_couloir / max(couloir_w, 1)))
        rooms.append({"name":"Couloir","x":0.0,"y":couloir_y,"w":couloir_w,"h":couloir_h,"type":"corridor"})
        # Chambres derrière
        nuit_y = snap(couloir_y + couloir_h)
        rooms.append({"name":"Ch. principale","x":0.0,"y":nuit_y,"w":snap(bpw),"h":snap(bph),"type":"bedroom"})
        cur_x = snap(bpw)
        for i in range(max(chambres - 1, 0)):
            rooms.append({"name":f"Chambre {i+2}","x":cur_x,"y":nuit_y,"w":snap(bsw),"h":snap(bsh),"type":"bedroom"})
            cur_x = snap(cur_x + bsw)
        # SDB
        sdb_y = snap(nuit_y + bph + 0.2)
        rooms.append({"name":"SDB principale","x":0.0,"y":sdb_y,"w":snap(sdbpw),"h":snap(sdbph),"type":"bathroom"})
        cur_x = snap(sdbpw)
        for i in range(max(sdb - 1, 0)):
            rooms.append({"name":f"SDB {i+2}","x":cur_x,"y":sdb_y,"w":snap(sdbsw),"h":snap(sdbsh),"type":"bathroom"})
            cur_x = snap(cur_x + sdbsw)
        # Garage à côté
        if gw > 0:
            rooms.append({"name":"Garage","x":snap(zone_w + 0.5),"y":0.0,"w":snap(gw),"h":snap(gh),"type":"garage"})
        max_x = max(r["x"] + r["w"] for r in rooms)
        max_y = max(r["y"] + r["h"] for r in rooms)
        
    elif layout_type == "couloir_central":
        # Couloir traversant, pièces de chaque côté
        couloir_w = snap(max(ew, sw, cw, bpw, bsw))
        couloir_h = snap(max(1.5, s_couloir / max(couloir_w, 1)))
        rooms.append({"name":"Couloir","x":0.0,"y":0.0,"w":couloir_w,"h":couloir_h,"type":"corridor"})
        # Côté façade (bas)
        rooms.append({"name":"Salon","x":0.0,"y":couloir_h,"w":snap(sw),"h":snap(sh),"type":"living"})
        rooms.append({"name":"Entrée","x":snap(sw),"y":couloir_h,"w":snap(ew),"h":snap(eh),"type":"corridor"})
        cuisine_x = snap(sw + ew)
        rooms.append({"name":"Cuisine","x":cuisine_x,"y":couloir_h,"w":snap(cw),"h":snap(ch),"type":"kitchen"})
        # Côté arrière (haut)
        nuit_y = snap(couloir_h + max(sh, ch, eh) + 0.2)
        rooms.append({"name":"Ch. principale","x":0.0,"y":nuit_y,"w":snap(bpw),"h":snap(bph),"type":"bedroom"})
        cur_x = snap(bpw)
        for i in range(max(chambres - 1, 0)):
            rooms.append({"name":f"Chambre {i+2}","x":cur_x,"y":nuit_y,"w":snap(bsw),"h":snap(bsh),"type":"bedroom"})
            cur_x = snap(cur_x + bsw)
        sdb_y = snap(nuit_y + bph + 0.2)
        rooms.append({"name":"SDB principale","x":0.0,"y":sdb_y,"w":snap(sdbpw),"h":snap(sdbph),"type":"bathroom"})
        cur_x = snap(sdbpw)
        for i in range(max(sdb - 1, 0)):
            rooms.append({"name":f"SDB {i+2}","x":cur_x,"y":sdb_y,"w":snap(sdbsw),"h":snap(sdbsh),"type":"bathroom"})
            cur_x = snap(cur_x + sdbsw)
        if gw > 0:
            rooms.append({"name":"Garage","x":couloir_w + 0.5,"y":0.0,"w":snap(gw),"h":snap(gh),"type":"garage"})
        max_x = max(r["x"] + r["w"] for r in rooms)
        max_y = max(r["y"] + r["h"] for r in rooms)
        
    elif layout_type == "L":
        # Forme en L : aile jour (salon, cuisine) horizontale, aile nuit verticale
        # Aile jour
        rooms.append({"name":"Entrée","x":0.0,"y":0.0,"w":snap(ew),"h":snap(eh),"type":"corridor"})
        salon_x = snap(ew)
        rooms.append({"name":"Salon","x":salon_x,"y":0.0,"w":snap(sw),"h":snap(sh),"type":"living"})
        cuisine_x = snap(salon_x + sw)
        rooms.append({"name":"Cuisine","x":cuisine_x,"y":0.0,"w":snap(cw),"h":snap(ch),"type":"kitchen"})
        zone_w = snap(ew + sw + cw)
        # Aile nuit perpendiculaire à droite
        nuit_x = snap(zone_w + 0.5)
        rooms.append({"name":"Ch. principale","x":nuit_x,"y":0.0,"w":snap(bpw),"h":snap(bph),"type":"bedroom"})
        cur_y = snap(bph)
        for i in range(max(chambres - 1, 0)):
            rooms.append({"name":f"Chambre {i+2}","x":nuit_x,"y":cur_y,"w":snap(bsw),"h":snap(bsh),"type":"bedroom"})
            cur_y = snap(cur_y + bsh)
        # SDB
        sdb_x = nuit_x
        sdb_y = snap(cur_y + 0.2)
        rooms.append({"name":"SDB principale","x":sdb_x,"y":sdb_y,"w":snap(sdbpw),"h":snap(sdbph),"type":"bathroom"})
        cur_y = snap(sdb_y + sdbph)
        for i in range(max(sdb - 1, 0)):
            rooms.append({"name":f"SDB {i+2}","x":sdb_x,"y":cur_y,"w":snap(sdbsw),"h":snap(sdbsh),"type":"bathroom"})
            cur_y = snap(cur_y + sdbsh)
        # Garage en bas à gauche
        if gw > 0:
            rooms.append({"name":"Garage","x":0.0,"y":snap(eh + 0.2),"w":snap(gw),"h":snap(gh),"type":"garage"})
        max_x = max(r["x"] + r["w"] for r in rooms)
        max_y = max(r["y"] + r["h"] for r in rooms)
        
    elif layout_type == "U":
        # Forme en U : trois ailes autour d'une cour intérieure (pour villa)
        # Aile basse (jour)
        rooms.append({"name":"Entrée","x":0.0,"y":0.0,"w":snap(ew),"h":snap(eh),"type":"corridor"})
        salon_x = snap(ew)
        rooms.append({"name":"Salon","x":salon_x,"y":0.0,"w":snap(sw),"h":snap(sh),"type":"living"})
        cuisine_x = snap(salon_x + sw)
        rooms.append({"name":"Cuisine","x":cuisine_x,"y":0.0,"w":snap(cw),"h":snap(ch),"type":"kitchen"})
        base_w = snap(ew + sw + cw)
        # Aile gauche (verticale)
        aile_g_x = 0.0
        aile_g_y = snap(eh + 0.2)
        rooms.append({"name":"Ch. principale","x":aile_g_x,"y":aile_g_y,"w":snap(bpw),"h":snap(bph),"type":"bedroom"})
        cur_y = snap(aile_g_y + bph)
        for i in range(max(chambres - 1, 0)):
            rooms.append({"name":f"Chambre {i+2}","x":aile_g_x,"y":cur_y,"w":snap(bsw),"h":snap(bsh),"type":"bedroom"})
            cur_y = snap(cur_y + bsh)
        # Aile droite (verticale)
        aile_d_x = snap(base_w - bpw)  # aligné à droite
        aile_d_y = snap(eh + 0.2)
        rooms.append({"name":"SDB principale","x":aile_d_x,"y":aile_d_y,"w":snap(sdbpw),"h":snap(sdbph),"type":"bathroom"})
        cur_y = snap(aile_d_y + sdbph)
        for i in range(max(sdb - 1, 0)):
            rooms.append({"name":f"SDB {i+2}","x":aile_d_x,"y":cur_y,"w":snap(sdbsw),"h":snap(sdbsh),"type":"bathroom"})
            cur_y = snap(cur_y + sdbsh)
        # Garage à droite ou gauche
        if gw > 0:
            rooms.append({"name":"Garage","x":base_w + 0.5,"y":0.0,"w":snap(gw),"h":snap(gh),"type":"garage"})
        max_x = max(r["x"] + r["w"] for r in rooms)
        max_y = max(r["y"] + r["h"] for r in rooms)
        
    elif layout_type == "profondeur":
        # Pièces en enfilade (profondeur)
        cur_x, cur_y = 0.0, 0.0
        rooms.append({"name":"Entrée","x":cur_x,"y":cur_y,"w":snap(ew),"h":snap(eh),"type":"corridor"})
        cur_y = snap(eh)
        rooms.append({"name":"Salon","x":cur_x,"y":cur_y,"w":snap(sw),"h":snap(sh),"type":"living"})
        cur_y = snap(cur_y + sh)
        rooms.append({"name":"Cuisine","x":cur_x,"y":cur_y,"w":snap(cw),"h":snap(ch),"type":"kitchen"})
        cur_y = snap(cur_y + ch)
        # Chambres à droite
        ch_x = snap(cur_x + max(ew, sw, cw) + 0.2)
        rooms.append({"name":"Ch. principale","x":ch_x,"y":0.0,"w":snap(bpw),"h":snap(bph),"type":"bedroom"})
        cur_y_ch = snap(bph)
        for i in range(max(chambres - 1, 0)):
            rooms.append({"name":f"Chambre {i+2}","x":ch_x,"y":cur_y_ch,"w":snap(bsw),"h":snap(bsh),"type":"bedroom"})
            cur_y_ch = snap(cur_y_ch + bsh)
        # SDB sous les chambres
        sdb_y = snap(cur_y_ch + 0.2)
        rooms.append({"name":"SDB principale","x":ch_x,"y":sdb_y,"w":snap(sdbpw),"h":snap(sdbph),"type":"bathroom"})
        cur_y_sdb = snap(sdb_y + sdbph)
        for i in range(max(sdb - 1, 0)):
            rooms.append({"name":f"SDB {i+2}","x":ch_x,"y":cur_y_sdb,"w":snap(sdbsw),"h":snap(sdbsh),"type":"bathroom"})
            cur_y_sdb = snap(cur_y_sdb + sdbsh)
        if gw > 0:
            rooms.append({"name":"Garage","x":0.0,"y":snap(cur_y + 0.2),"w":snap(gw),"h":snap(gh),"type":"garage"})
        max_x = max(r["x"] + r["w"] for r in rooms)
        max_y = max(r["y"] + r["h"] for r in rooms)
    
    # Post-processing : ajuster les coordonnées pour qu'elles commencent à (0,0)
    min_x = min(r["x"] for r in rooms)
    min_y = min(r["y"] for r in rooms)
    for r in rooms:
        r["x"] = snap(r["x"] - min_x)
        r["y"] = snap(r["y"] - min_y)
    max_x = max(r["x"] + r["w"] for r in rooms)
    max_y = max(r["y"] + r["h"] for r in rooms)
    
    # Génération des portes et fenêtres (fonctions inchangées)
    doors = _place_doors(rooms, type_bien)
    windows = _place_windows(rooms)
    furniture = _place_furniture(rooms)
    
    # Terrain et extérieurs
    recul_av  = ctx_rules["recul_avant"]
    recul_lat = ctx_rules["recul_lateral"]
    recul_ar  = ctx_rules["recul_arriere"]
    terrain = {
        "x": snap(-recul_lat - 0.5),
        "y": snap(-recul_av - 0.5),
        "w": snap(max_x + recul_lat * 2 + 1.0),
        "h": snap(max_y + recul_av + recul_ar + 1.0),
    }
    jardins = []
    piscine = None
    terrasse = None
    if type_bien in ["maison", "villa"]:
        jardins = [
            {"name":"Jardin avant","x":terrain["x"]+0.5,"y":terrain["y"]+0.5,
             "w":terrain["w"]-1.0,"h":recul_av-0.5,"type":"jardin"},
            {"name":"Jardin arrière","x":terrain["x"]+0.5,"y":snap(max_y+0.5),
             "w":terrain["w"]-1.0,"h":recul_ar-0.5,"type":"jardin"},
        ]
        terrasse = {
            "name":"Terrasse","x":snap(0.5),"y":snap(-recul_av+0.5),
            "w":snap(min(max_x*0.6, 8.0)),"h":snap(2.0),"type":"terrasse"
        }
        if type_bien == "villa":
            piscine = {
                "name":"Piscine","x":snap(terrain["x"]+2.0),"y":snap(max_y+1.5),
                "w":5.0,"h":3.0,"type":"piscine"
            }
    
    plan = {
        "rooms": rooms,
        "doors": doors,
        "windows": windows,
        "furniture": furniture,
        "jardins": jardins,
        "piscine": piscine,
        "terrasse": terrasse,
        "terrain": terrain,
        "context": {
            "type_bien": type_bien, "contexte": contexte,
            "recul_avant": recul_av, "recul_lateral": recul_lat,
            "recul_arriere": recul_ar, "cloture": ctx_rules["cloture"]
        },
        "total_surface": surface,
        "style": style,
        "layout": layout_type,
        "wall_thickness": WALL_THICKNESS,
        "scale": "1:100",
        "ceiling_height": CEILING_HEIGHT,
    }
    return {"success": True, "plan": plan}

# Les fonctions _place_doors, _place_windows, _place_furniture, estimate_cost restent inchangées
# (elles sont identiques à celles de l'original, donc pas besoin de les recopier ici pour gagner de la place)
# Mais pour que le code soit complet, je les inclus ci-dessous rapidement.

def _place_doors(rooms, type_bien):
    doors = []
    processed_pairs = set()
    for i, room in enumerate(rooms):
        rx, ry, rw, rh = room["x"], room["y"], room["w"], room["h"]
        for j, other in enumerate(rooms):
            if i >= j: continue
            pair_key = (min(i,j), max(i,j))
            if pair_key in processed_pairs: continue
            ox, oy, ow, oh = other["x"], other["y"], other["w"], other["h"]
            if abs((ry) - (oy + oh)) < 0.05:
                overlap_x1 = max(rx, ox)
                overlap_x2 = min(rx + rw, ox + ow)
                overlap = overlap_x2 - overlap_x1
                if overlap >= DOOR_WIDTH + 0.2:
                    door_x = snap(overlap_x1 + (overlap - DOOR_WIDTH) / 2)
                    is_main = (room["type"] == "corridor" or other["type"] == "corridor")
                    dw = DOOR_WIDTH_MAIN if is_main else DOOR_WIDTH
                    doors.append({
                        "x": door_x, "y": snap(ry),
                        "w": dw, "orientation": "h",
                        "type": "principale" if room["name"] == "Entrée" or other["name"] == "Entrée" else "interieure",
                        "from": room["name"], "to": other["name"],
                        "swing": "left"
                    })
                    processed_pairs.add(pair_key)
            elif abs((rx) - (ox + ow)) < 0.05:
                overlap_y1 = max(ry, oy)
                overlap_y2 = min(ry + rh, oy + oh)
                overlap = overlap_y2 - overlap_y1
                if overlap >= DOOR_WIDTH + 0.2:
                    door_y = snap(overlap_y1 + (overlap - DOOR_WIDTH) / 2)
                    is_main = (room["type"] == "corridor" or other["type"] == "corridor")
                    dw = DOOR_WIDTH_MAIN if is_main else DOOR_WIDTH
                    doors.append({
                        "x": snap(rx), "y": door_y,
                        "w": dw, "orientation": "v",
                        "type": "principale" if room["name"] == "Entrée" or other["name"] == "Entrée" else "interieure",
                        "from": room["name"], "to": other["name"],
                        "swing": "down"
                    })
                    processed_pairs.add(pair_key)
    entree = next((r for r in rooms if r["name"] == "Entrée"), None)
    if entree:
        doors.append({
            "x": snap(entree["x"] + (entree["w"] - DOOR_WIDTH_MAIN) / 2),
            "y": snap(entree["y"]),
            "w": DOOR_WIDTH_MAIN, "orientation": "h",
            "type": "principale", "from": "Extérieur", "to": "Entrée",
            "swing": "left"
        })
    garage = next((r for r in rooms if r["type"] == "garage"), None)
    if garage:
        doors.append({
            "x": snap(garage["x"] + (garage["w"] - 2.4) / 2),
            "y": snap(garage["y"]),
            "w": 2.4, "orientation": "h",
            "type": "garage", "from": "Extérieur", "to": "Garage",
            "swing": "up"
        })
    return doors

def _place_windows(rooms):
    windows = []
    all_rooms_bounds = [(r["x"], r["y"], r["x"]+r["w"], r["y"]+r["h"]) for r in rooms]
    def is_exterior_wall(room, wall_side):
        rx, ry, rw, rh = room["x"], room["y"], room["w"], room["h"]
        for i, (ox1, oy1, ox2, oy2) in enumerate(all_rooms_bounds):
            if rooms[i]["name"] == room["name"]: continue
            if wall_side == "top" and abs(ry - oy2) < 0.1:
                if ox1 < rx + rw and ox2 > rx: return False
            elif wall_side == "bottom" and abs(ry + rh - oy1) < 0.1:
                if ox1 < rx + rw and ox2 > rx: return False
            elif wall_side == "left" and abs(rx - ox2) < 0.1:
                if oy1 < ry + rh and oy2 > ry: return False
            elif wall_side == "right" and abs(rx + rw - ox1) < 0.1:
                if oy1 < ry + rh and oy2 > ry: return False
        return True
    for room in rooms:
        if room["type"] in ["corridor", "dressing"]: continue
        rx, ry, rw, rh = room["x"], room["y"], room["w"], room["h"]
        if is_exterior_wall(room, "top") and rw >= WINDOW_WIDTH + 0.8:
            nb_windows = max(1, int(rw / (WINDOW_WIDTH + 1.0)))
            spacing = (rw - nb_windows * WINDOW_WIDTH) / (nb_windows + 1)
            for k in range(nb_windows):
                wx = snap(rx + spacing + k * (WINDOW_WIDTH + spacing))
                windows.append({"x": wx, "y": snap(ry), "w": WINDOW_WIDTH, "wall": "top", "room": room["name"], "sill_height": WINDOW_HEIGHT_FROM_FLOOR, "type": "standard"})
        if is_exterior_wall(room, "bottom") and rw >= WINDOW_WIDTH + 0.8:
            wx = snap(rx + (rw - WINDOW_WIDTH) / 2)
            windows.append({"x": wx, "y": snap(ry + rh), "w": WINDOW_WIDTH, "wall": "bottom", "room": room["name"], "sill_height": WINDOW_HEIGHT_FROM_FLOOR, "type": "standard"})
        if is_exterior_wall(room, "left") and rh >= WINDOW_WIDTH + 0.8:
            wy = snap(ry + (rh - WINDOW_WIDTH) / 2)
            windows.append({"x": snap(rx), "y": wy, "w": WINDOW_WIDTH, "wall": "left", "room": room["name"], "sill_height": WINDOW_HEIGHT_FROM_FLOOR, "type": "standard"})
        if is_exterior_wall(room, "right") and rh >= WINDOW_WIDTH + 0.8:
            wy = snap(ry + (rh - WINDOW_WIDTH) / 2)
            windows.append({"x": snap(rx + rw), "y": wy, "w": WINDOW_WIDTH, "wall": "right", "room": room["name"], "sill_height": WINDOW_HEIGHT_FROM_FLOOR, "type": "standard"})
        if room["type"] == "bathroom":
            for win in windows[-2:]:
                win["w"] = 0.60
                win["type"] = "sdb"
    return windows

def _place_furniture(rooms):
    furniture = []
    for room in rooms:
        rx, ry, rw, rh = room["x"], room["y"], room["w"], room["h"]
        rtype = room["type"]
        if rtype == "bedroom":
            mlist = MOBILIER["bedroom"] if rw >= 3.5 or rh >= 3.5 else MOBILIER["bedroom_s"]
        else:
            mlist = MOBILIER.get(rtype, [])
        pad = 0.15
        if rtype == "living":
            for m in mlist:
                if m["name"] == "TV":
                    furniture.append({**m, "x":snap(rx+pad), "y":snap(ry+pad), "rot":0, "room":room["name"]})
                elif m["name"] == "Canapé":
                    furniture.append({**m, "x":snap(rx+(rw-m["w"])/2), "y":snap(ry+rh-m["h"]-pad*2), "rot":0, "room":room["name"]})
                elif m["name"] == "Table basse":
                    furniture.append({**m, "x":snap(rx+(rw-m["w"])/2), "y":snap(ry+rh-m["h"]-1.2), "rot":0, "room":room["name"]})
                elif m["name"] == "Fauteuil":
                    furniture.append({**m, "x":snap(rx+rw-m["w"]-pad), "y":snap(ry+rh-m["h"]-pad*2), "rot":0, "room":room["name"]})
        elif rtype == "kitchen":
            fx, fy = snap(rx+pad), snap(ry+pad)
            for m in mlist:
                if fx + m["w"] < rx + rw - pad:
                    furniture.append({**m, "x":fx, "y":fy, "rot":0, "room":room["name"]})
                    fx = snap(fx + m["w"] + 0.05)
        elif rtype == "bedroom":
            for m in mlist:
                if m["name"] in ["Lit 160","Lit 120"]:
                    furniture.append({**m, "x":snap(rx+(rw-m["w"])/2), "y":snap(ry+rh-m["h"]-pad), "rot":0, "room":room["name"]})
                elif m["name"] == "Armoire":
                    furniture.append({**m, "x":snap(rx+pad), "y":snap(ry+pad), "rot":0, "room":room["name"]})
                elif m["name"] in ["Table nuit","Bureau"]:
                    furniture.append({**m, "x":snap(rx+rw-m["w"]-pad), "y":snap(ry+rh-m["h"]-pad), "rot":0, "room":room["name"]})
        elif rtype == "bathroom":
            bx, by = snap(rx+pad), snap(ry+pad)
            for m in mlist:
                if bx + m["w"] < rx + rw - pad and by + m["h"] < ry + rh - pad:
                    furniture.append({**m, "x":bx, "y":by, "rot":0, "room":room["name"]})
                    bx = snap(bx + m["w"] + 0.08)
                    if bx > rx + rw * 0.5:
                        bx = snap(rx + pad)
                        by = snap(by + 0.8)
        elif rtype == "garage" and mlist:
            m = mlist[0]
            furniture.append({**m, "x":snap(rx+(rw-m["w"])/2), "y":snap(ry+rh-m["h"]-pad), "rot":0, "room":room["name"]})
    return furniture

def estimate_cost(plan: dict) -> dict:
    COST = {"living":9000,"kitchen":13000,"bedroom":8500,"bathroom":16000,"corridor":6000,"dressing":7500,"garage":4500,"patio":4000,"default":8500}
    MULT = {"villa":1.35,"maison":1.0,"appartement":0.92}
    type_bien = plan.get("context",{}).get("type_bien","maison")
    mult = MULT.get(type_bien, 1.0)
    total, details = 0, []
    for r in plan.get("rooms",[]):
        s = round(r["w"] * r["h"], 1)
        c = round(s * COST.get(r["type"], COST["default"]) * mult)
        total += c
        details.append({"room":r["name"],"surface":s,"cost":c,"type":r["type"]})
    return {"total_cost_mad": total, "total_cost_formatted": f"{total:,.0f} MAD", "details": details, "cost_per_m2": round(total / max(plan.get("total_surface",1), 1))}