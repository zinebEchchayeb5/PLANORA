"""
Télécharge RPLAN - 80 000 vrais plans
"""

import os
import json
import requests

def download_rplan_small():
    """Version légère de RPLAN (~5000 plans)"""
    
    os.makedirs("data", exist_ok=True)
    
    # URL du dataset RPLAN
    url = "https://raw.githubusercontent.com/zzilch/RPLAN/master/data/rplan_processed.json"
    
    print("📥 Téléchargement RPLAN...")
    response = requests.get(url)
    data = response.json()
    
    plans = []
    for item in data:
        plan = {
            "surface": item.get("area", 100),
            "chambres": item.get("num_bedrooms", 3),
            "sdb": item.get("num_bathrooms", 1),
            "rooms": item.get("rooms", []),
            "style": detect_style(item)
        }
        plans.append(plan)
    
    with open("data/real_plans.json", "w") as f:
        json.dump(plans, f, ensure_ascii=False, indent=2)
    
    print(f"✅ {len(plans)} vrais plans téléchargés")
    return plans

def detect_style(plan):
    # Logique de détection de style
    return "moderne"

if __name__ == "__main__":
    download_rplan_small()