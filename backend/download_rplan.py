"""
Téléchargement du dataset RPLAN — 80 000 vrais plans architecturaux
Source : https://github.com/zzilch/RPLAN
"""

import os
import json
import requests
import zipfile
from tqdm import tqdm

DATA_DIR = "data/rplan"

def download_rplan():
    """Télécharge et extrait le dataset RPLAN"""
    
    os.makedirs(DATA_DIR, exist_ok=True)
    
    # URLs des fichiers RPLAN
    files = {
        "rplan.zip": "https://github.com/zzilch/RPLAN/releases/download/v1.0/rplan_dataset.zip"
    }
    
    for filename, url in files.items():
        filepath = os.path.join(DATA_DIR, filename)
        
        if not os.path.exists(filepath):
            print(f"📥 Téléchargement de {filename}...")
            response = requests.get(url, stream=True)
            total_size = int(response.headers.get('content-length', 0))
            
            with open(filepath, "wb") as f:
                with tqdm(total=total_size, unit='B', unit_scale=True) as pbar:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                        pbar.update(len(chunk))
            
            print(f"✅ {filename} téléchargé")
    
    # Extraction
    zip_path = os.path.join(DATA_DIR, "rplan.zip")
    if os.path.exists(zip_path) and not os.path.exists(os.path.join(DATA_DIR, "plans")):
        print("📦 Extraction...")
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(DATA_DIR)
        print("✅ Extraction terminée")

def parse_rplan_to_json():
    """Convertit RPLAN en format PLANORA compatible"""
    
    plans_json = []
    plans_dir = os.path.join(DATA_DIR, "plans")
    
    for i, plan_file in enumerate(os.listdir(plans_dir)):
        if plan_file.endswith(".json"):
            with open(os.path.join(plans_dir, plan_file), "r") as f:
                plan_data = json.load(f)
            
            # Extraire les pièces
            rooms = []
            for room in plan_data.get("rooms", []):
                rooms.append({
                    "name": room.get("type", "Pièce"),
                    "x": room.get("bounding_box", {}).get("x", 0),
                    "y": room.get("bounding_box", {}).get("y", 0),
                    "w": room.get("bounding_box", {}).get("width", 4),
                    "h": room.get("bounding_box", {}).get("height", 4),
                    "type": map_room_type(room.get("type", ""))
                })
            
            plan = {
                "id": f"rplan_{i}",
                "surface": plan_data.get("surface", 100),
                "rooms": rooms,
                "layout": detect_layout(rooms),
                "style": "real",  # Vrai plan
                "source": "RPLAN"
            }
            plans_json.append(plan)
    
    # Sauvegarder
    output_path = os.path.join(DATA_DIR, "rplan_plans.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(plans_json, f, ensure_ascii=False, indent=2)
    
    print(f"✅ {len(plans_json)} plans convertis → {output_path}")

def map_room_type(rplan_type):
    """Mapping RPLAN → PLANORA"""
    mapping = {
        "living_room": "living",
        "bedroom": "bedroom",
        "kitchen": "kitchen",
        "bathroom": "bathroom",
        "corridor": "corridor",
        "balcony": "balcony",
        "storage": "dressing"
    }
    return mapping.get(rplan_type, "living")

def detect_layout(rooms):
    """Détecte le layout à partir des positions"""
    if not rooms:
        return "horizontal"
    
    max_x = max(r["x"] + r["w"] for r in rooms)
    max_y = max(r["y"] + r["h"] for r in rooms)
    
    if abs(max_x - max_y) < 3:
        return "compact"
    elif max_x > max_y * 1.5:
        return "horizontal"
    elif max_y > max_x * 1.5:
        return "vertical"
    else:
        return "L-shape"

if __name__ == "__main__":
    download_rplan()
    parse_rplan_to_json()