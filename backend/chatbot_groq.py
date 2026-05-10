import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

SYSTEM_PROMPT = """Tu es PLANORA, un assistant architectural IA très intelligent et naturel.

LANGUES SUPPORTÉES:
- Darija marocaine (عربية مغربية) → réponds en darija
- Français → réponds en français
- Anglais → réponds en anglais
- Arabe classique (العربية الفصحى) → réponds en arabe
- Mélange → adapte-toi naturellement à la langue dominante

DÉTECTION AUTOMATIQUE DE LANGUE:
- "wach", "kifach", "bghit", "mzyan", "safi", "daba", "walakin" → darija
- "كيفاش", "بغيت", "واش" → darija arabe
- مبادئ معمارية → arabe classique
- "comment", "pourquoi", "je veux" → français
- "how", "what", "I want" → anglais

PERSONNALITÉ:
- Comme un ami architecte expert, pas un robot
- Naturel, direct, utile
- Pose des questions si besoin de précisions
- Donne des conseils concrets et chiffrés

EXPERTISE:
- Plans architecturaux marocains et internationaux
- Normes DTM, règlements urbanisme Maroc
- Matériaux: béton, brique, zellige, tadelakt, bois cèdre, pisé
- Styles: moderne, marocain (riad, patio), minimaliste, contemporain
- Coûts MAD selon région et type
- Optimisation espaces, circulation, luminosité
- Orientation solaire Maroc
- Réglementations: reculs, hauteurs, COS, CES
- Gestion de bureau d'étude: projets, clients, facturation

EXEMPLES DARIJA:
- "wah, had salon dyal 30m² mzyan, walakin cuisine diyalek s9ira bzzaf..."
- "zwina! had le plan kayn fih 3 chambres, nsah nzid SDB khra..."
- "safi, bghiti nfhm: wach had maison f ville wla f campagne?"

Réponds de manière naturelle, max 4-5 phrases sauf si on demande plus."""


LANG_VOICES = {
    "fr": "fr-FR",
    "ar": "ar-SA",
    "darija": "ar-MA",
    "en": "en-US",
}


def detect_language(text: str) -> str:
    """Détecte la langue dominante du texte."""
    darija_words = ["wach", "kifach", "bghit", "mzyan", "safi", "daba", "walakin",
                    "nta", "ana", "hna", "kayn", "machi", "zwina", "bzaf", "khoya",
                    "iyeh", "la", "3andek", "khdm", "dir", "chuf", "goul", "9al"]
    french_words = ["comment", "pourquoi", "je", "tu", "nous", "vous", "bonjour",
                    "merci", "oui", "non", "est", "sont", "avec", "pour", "dans"]
    arabic_chars = sum(1 for c in text if '\u0600' <= c <= '\u06FF')

    text_lower = text.lower()
    darija_score = sum(1 for w in darija_words if w in text_lower)
    french_score = sum(1 for w in french_words if w in text_lower)

    if darija_score >= 2 or (darija_score >= 1 and arabic_chars > 3):
        return "darija"
    elif arabic_chars > len(text) * 0.3:
        return "ar"
    elif french_score >= 2:
        return "fr"
    elif any(w in text_lower for w in ["how", "what", "why", "where", "when", "i ", "the "]):
        return "en"
    else:
        return "fr"


def build_context(plan_context):
    if not plan_context:
        return ""
    rooms = plan_context.get("rooms", [])
    ctx = plan_context.get("context", {})
    rooms_info = "\n".join([
        f"  - {r['name']}: {round(r.get('w', 0) * r.get('h', 0), 1)}m² ({r.get('type', '')})"
        for r in rooms
    ])
    return f"""
[PLAN ACTUEL]
Type: {ctx.get('type_bien', '?')} | Style: {plan_context.get('style', '?')} | Surface: {plan_context.get('total_surface', '?')}m²
Contexte: {ctx.get('contexte', '?')} | Reculs: av.{ctx.get('recul_avant', '?')}m / lat.{ctx.get('recul_lateral', '?')}m
Pièces:
{rooms_info}
"""


def chat_groq(question: str, history: list = None, plan_context: dict = None) -> str:
    """Chat synchrone (pour rapports IA et analyses)."""
    context = build_context(plan_context)
    lang = detect_language(question)
    lang_instruction = {
        "darija": "\nIMPORTANT: L'utilisateur parle darija. Réponds UNIQUEMENT en darija marocaine.",
        "ar": "\nIMPORTANT: L'utilisateur parle arabe. Réponds en arabe classique.",
        "en": "\nIMPORTANT: The user speaks English. Reply ONLY in English.",
        "fr": ""
    }.get(lang, "")

    system = SYSTEM_PROMPT + lang_instruction + (f"\n{context}" if context else "")
    messages = [{"role": "system", "content": system}]

    if history:
        for msg in history[-6:]:
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": question})

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        max_tokens=500,
        temperature=0.7,
        stream=False
    )
    return response.choices[0].message.content


def chat_groq_stream(question: str, history: list = None, plan_context: dict = None):
    """Generator pour streaming avec détection de langue."""
    context = build_context(plan_context)
    lang = detect_language(question)
    lang_instruction = {
        "darija": "\nIMPORTANT: L'utilisateur parle darija. Réponds UNIQUEMENT en darija marocaine.",
        "ar": "\nIMPORTANT: L'utilisateur parle arabe. Réponds en arabe classique.",
        "en": "\nIMPORTANT: The user speaks English. Reply ONLY in English.",
        "fr": ""
    }.get(lang, "")

    system = SYSTEM_PROMPT + lang_instruction + (f"\n{context}" if context else "")
    messages = [{"role": "system", "content": system}]

    if history:
        for msg in history[-6:]:
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": question})

    stream = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        max_tokens=500,
        temperature=0.7,
        stream=True
    )

    # Yield language info first as metadata
    yield f"__LANG__{lang}__"

    for chunk in stream:
        token = chunk.choices[0].delta.content or ""
        if token:
            yield token