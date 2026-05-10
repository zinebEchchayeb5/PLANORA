from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import json, os, copy
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
router = APIRouter(prefix="/plan-editor", tags=["plan-editor"])

# ── SYSTEM PROMPT ────────────────────────────────
SYSTEM = """Tu es PLANORA AI — architecte expert. Tu modifies des plans architecturaux.

Tu comprends TOUTES les langues (darija, français, arabe, anglais, fautes d'orthographe).
EXEMPLES de compréhension:
- "chnager cusinine et sallon" → changer cuisine et salon (correction orthographe)
- "kbr le salon" → agrandis le salon
- "زيد غرفة" → ajoute une chambre
- "cuisine serra premiere" → mets cuisine en premier/après entrée
- "trop petit le couloir" → agrandis couloir
- "enleve garage" → supprime garage
- "je veux dressing" → ajoute dressing
- "4 chambres" → avoir 4 chambres au total
- "swap salon cuisine" → échange positions salon et cuisine

RETOURNE CE JSON COMPACT (pas de markdown, RIEN d'autre):
{
  "understood": "ce que tu as compris en français",
  "operations": [
    {"op": "modify_room", "name": "Salon", "changes": {"w": 6.0, "h": 4.0}},
    {"op": "modify_room", "name": "Cuisine", "changes": {"x": 5.0, "y": 0.0}},
    {"op": "add_room", "room": {"name": "Dressing", "x": 8.0, "y": 5.0, "w": 2.5, "h": 2.0, "type": "dressing", "wall_type": "cloison"}},
    {"op": "delete_room", "name": "Garage"},
    {"op": "swap_rooms", "name1": "Salon", "name2": "Cuisine"},
    {"op": "change_style", "style": "marocain"},
    {"op": "rename_room", "old_name": "Couloir", "new_name": "Hall"},
    {"op": "modify_room", "name": "Ch. principale", "changes": {"type": "dressing"}}
  ],
  "message": "message court pour l'user (même langue que sa demande)"
}

OPÉRATIONS DISPONIBLES:
- modify_room: modifie w/h/x/y/name/type d'une pièce existante
- add_room: ajoute une nouvelle pièce
- delete_room: supprime une pièce
- swap_rooms: échange les positions x,y de 2 pièces
- change_style: change le style global
- rename_room: renomme une pièce

RÈGLES:
- Trouve la pièce par ressemblance (ex: "salllon" = "Salon", "cusinine" = "Cuisine")
- Si plusieurs opérations nécessaires, liste-les toutes
- Dimensions en mètres (floats)
- Normes min: chambre 9m², SDB 3.5m², salon 18m²"""


class PlanEditRequest(BaseModel):
    instruction: str
    plan: dict
    history: Optional[List[dict]] = []


def compact_plan_for_ai(plan: dict) -> str:
    """Send only room names/dims to AI — much shorter."""
    rooms = [{"name": r["name"], "x": r.get("x",0), "y": r.get("y",0),
               "w": r.get("w",0), "h": r.get("h",0), "type": r.get("type","default")}
             for r in plan.get("rooms", [])]
    return json.dumps({
        "style": plan.get("style", "moderne"),
        "type_bien": plan.get("context", {}).get("type_bien", "maison"),
        "total_surface": plan.get("total_surface", 0),
        "rooms": rooms
    }, ensure_ascii=False)


def fuzzy_find_room(rooms: list, name: str):
    """Find room by fuzzy name matching."""
    name_lower = name.lower().strip()
    # Exact match
    for r in rooms:
        if r["name"].lower() == name_lower:
            return r
    # Partial match
    for r in rooms:
        if name_lower in r["name"].lower() or r["name"].lower() in name_lower:
            return r
    # Type match
    type_map = {
        "salon": "living", "sallon": "living", "séjour": "living",
        "cuisine": "kitchen", "cusinine": "kitchen", "cucine": "kitchen",
        "chambre": "bedroom", "sdb": "bathroom", "couloir": "corridor",
        "garage": "garage", "dressing": "dressing", "entree": "corridor",
        "entrée": "corridor", "hall": "corridor"
    }
    for keyword, rtype in type_map.items():
        if keyword in name_lower:
            for r in rooms:
                if r.get("type") == rtype:
                    return r
    return None


def apply_operations(plan: dict, operations: list) -> dict:
    """Apply AI operations to the plan."""
    result = copy.deepcopy(plan)
    rooms = result.get("rooms", [])

    for op in operations:
        op_type = op.get("op", "")

        if op_type == "modify_room":
            room = fuzzy_find_room(rooms, op.get("name", ""))
            if room:
                changes = op.get("changes", {})
                for k, v in changes.items():
                    room[k] = v

        elif op_type == "add_room":
            new_room = op.get("room", {})
            if new_room.get("name"):
                # Avoid duplicate
                if not fuzzy_find_room(rooms, new_room["name"]):
                    # Default wall_type if missing
                    if "wall_type" not in new_room:
                        new_room["wall_type"] = "cloison"
                    rooms.append(new_room)

        elif op_type == "delete_room":
            room = fuzzy_find_room(rooms, op.get("name", ""))
            if room:
                rooms.remove(room)

        elif op_type == "swap_rooms":
            r1 = fuzzy_find_room(rooms, op.get("name1", ""))
            r2 = fuzzy_find_room(rooms, op.get("name2", ""))
            if r1 and r2:
                r1["x"], r2["x"] = r2["x"], r1["x"]
                r1["y"], r2["y"] = r2["y"], r1["y"]

        elif op_type == "change_style":
            result["style"] = op.get("style", result.get("style"))

        elif op_type == "rename_room":
            room = fuzzy_find_room(rooms, op.get("old_name", ""))
            if room:
                room["name"] = op.get("new_name", room["name"])

    # Recalculate total_surface
    result["rooms"] = rooms
    result["total_surface"] = round(sum(r.get("w", 0) * r.get("h", 0) for r in rooms))
    return result


@router.post("/edit")
def edit_plan(req: PlanEditRequest):
    compact = compact_plan_for_ai(req.plan)

    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": f'INSTRUCTION: "{req.instruction}"\n\nPLAN:\n{compact}\n\nRetourne UNIQUEMENT le JSON operations.'}
    ]

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            max_tokens=800,  # Small — only operations not full plan
            temperature=0.1,
        )

        content = response.choices[0].message.content.strip()

        # Clean markdown
        if "```" in content:
            for part in content.split("```"):
                p = part.strip()
                if p.startswith("json"): p = p[4:].strip()
                if p.startswith("{"): content = p; break

        # Extract JSON
        s = content.find("{"); e = content.rfind("}") + 1
        if s >= 0 and e > s:
            content = content[s:e]

        result = json.loads(content)

        operations = result.get("operations", [])
        understood = result.get("understood", req.instruction)
        message = result.get("message", "Modification effectuée")

        if not operations:
            return {
                "success": False,
                "error": f"Je n'ai pas compris comment modifier le plan pour: {req.instruction}",
                "plan": req.plan
            }

        # Apply operations to full plan
        new_plan = apply_operations(req.plan, operations)

        changes = []
        for op in operations:
            ot = op.get("op","")
            if ot == "modify_room":
                changes.append(f"Modifié: {op.get('name')} → {op.get('changes')}")
            elif ot == "add_room":
                changes.append(f"Ajouté: {op.get('room',{}).get('name','?')}")
            elif ot == "delete_room":
                changes.append(f"Supprimé: {op.get('name')}")
            elif ot == "swap_rooms":
                changes.append(f"Échangé positions: {op.get('name1')} ↔ {op.get('name2')}")
            elif ot == "change_style":
                changes.append(f"Style changé: {op.get('style')}")
            elif ot == "rename_room":
                changes.append(f"Renommé: {op.get('old_name')} → {op.get('new_name')}")

        return {
            "success": True,
            "understood": understood,
            "action": understood,
            "plan": new_plan,
            "message": message,
            "changes": changes
        }

    except json.JSONDecodeError as e:
        return {"success": False, "error": f"Erreur parsing IA: {str(e)[:80]}", "plan": req.plan}
    except Exception as e:
        return {"success": False, "error": str(e)[:150], "plan": req.plan}


@router.post("/chat")
def chat_about_plan(req: PlanEditRequest):
    """General Q&A about plan."""
    lang = _detect_lang(req.instruction)
    rooms = ", ".join([f"{r['name']}({round(r.get('w',0)*r.get('h',0),1)}m²)" for r in req.plan.get("rooms",[])[:6]])

    messages = [
        {"role": "system", "content": f"PLANORA architecte. Réponds en {lang}. Plan: {req.plan.get('total_surface','?')}m², pièces: {rooms}. Max 3 phrases."},
        {"role": "user", "content": req.instruction}
    ]

    def stream():
        try:
            s = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages, max_tokens=200, temperature=0.6, stream=True
            )
            for chunk in s:
                yield chunk.choices[0].delta.content or ""
        except Exception as e:
            yield f"Erreur: {e}"

    return StreamingResponse(stream(), media_type="text/plain")


def _detect_lang(text: str) -> str:
    darija = ["wach","kifach","bghit","mzyan","safi","daba","zid","dir","bdel","kbr","s9r","hder","nta","ana","kayn"]
    tl = text.lower()
    if any(w in tl for w in darija): return "darija"
    ar = sum(1 for c in text if '\u0600' <= c <= '\u06FF')
    if ar > len(text) * 0.25: return "arabe"
    if any(w in tl for w in ["how","add","make","change","remove","put","want"]): return "anglais"
    return "français"