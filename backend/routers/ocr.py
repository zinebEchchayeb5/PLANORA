from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import os
import json
import tempfile
from chatbot_groq import chat_groq

router = APIRouter(prefix="/ocr", tags=["ocr"])

def extract_text_from_image(image_bytes: bytes) -> str:
    try:
        import pytesseract
        from PIL import Image
        from io import BytesIO
        img = Image.open(BytesIO(image_bytes))
        text = pytesseract.image_to_string(img, lang="fra+ara+eng")
        return text
    except Exception as e:
        return f"Erreur OCR: {e}"

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    try:
        import fitz  # PyMuPDF
        import tempfile, os
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as f:
            f.write(pdf_bytes)
            path = f.name
        doc = fitz.open(path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        os.unlink(path)
        return text
    except Exception as e:
        # Fallback: try pdf2image + tesseract
        try:
            from pdf2image import convert_from_bytes
            import pytesseract
            images = convert_from_bytes(pdf_bytes)
            text = ""
            for img in images:
                text += pytesseract.image_to_string(img, lang="fra+ara+eng")
            return text
        except Exception as e2:
            return f"Erreur PDF: {e2}"

def parse_with_ai(raw_text: str) -> dict:
    prompt = f"""Tu es un expert comptable. Analyse ce texte extrait d'une facture et extrais les données.

TEXTE DE LA FACTURE:
{raw_text[:3000]}

Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans texte avant ou après):
{{
  "numero_facture": "string ou null",
  "date_emission": "DD/MM/YYYY ou null",
  "date_echeance": "DD/MM/YYYY ou null",
  "montant_ht": number ou null,
  "tva": number (pourcentage) ou null,
  "montant_ttc": number ou null,
  "fournisseur": "string ou null",
  "client": "string ou null",
  "description": "string résumé ou null",
  "statut": "payee ou impayee ou inconnu",
  "devise": "MAD ou EUR ou USD",
  "confidence": number (0-100)
}}"""

    try:
        response = chat_groq(prompt)
        # Clean response
        response = response.strip()
        if "```" in response:
            response = response.split("```")[1]
            if response.startswith("json"):
                response = response[4:]
        return json.loads(response)
    except Exception as e:
        return {"error": str(e), "raw_text": raw_text[:500]}

@router.post("/scan-facture")
async def scan_facture(file: UploadFile = File(...)):
    """Scan une facture (PDF ou image) et extrait les données automatiquement."""
    content = await file.read()
    filename = file.filename.lower()

    # Extract text
    if filename.endswith(".pdf"):
        raw_text = extract_text_from_pdf(content)
    elif any(filename.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"]):
        raw_text = extract_text_from_image(content)
    else:
        raise HTTPException(400, "Format non supporté. Utilisez PDF, JPG, PNG.")

    if not raw_text or len(raw_text.strip()) < 20:
        return {"success": False, "error": "Impossible d'extraire le texte", "raw_text": raw_text}

    # Parse with AI
    data = parse_with_ai(raw_text)
    return {
        "success": True,
        "extracted": data,
        "raw_text_preview": raw_text[:300]
    }


@router.post("/scan-document")
async def scan_document(file: UploadFile = File(...), doc_type: str = "general"):
    """Scan un document quelconque et extrait les données selon le type."""
    content = await file.read()
    filename = file.filename.lower()

    if filename.endswith(".pdf"):
        raw_text = extract_text_from_pdf(content)
    else:
        raw_text = extract_text_from_image(content)

    type_prompts = {
        "devis": "devis/offre commerciale — extrais: référence, date, client, prestations, montants",
        "contrat": "contrat — extrais: parties, objet, durée, montant, clauses principales",
        "bon_commande": "bon de commande — extrais: fournisseur, articles, quantités, prix",
        "general": "document administratif — extrais les informations principales",
    }

    prompt = f"""Analyse ce texte extrait d'un {type_prompts.get(doc_type, 'document')}.

TEXTE:
{raw_text[:3000]}

Réponds avec un JSON valide contenant les champs extraits et un champ "resume" avec un résumé en 2 phrases."""

    try:
        response = chat_groq(prompt)
        response = response.strip()
        if "```" in response:
            response = response.split("```")[1]
            if response.startswith("json"): response = response[4:]
        data = json.loads(response)
    except:
        data = {"resume": raw_text[:200], "raw": True}

    return {"success": True, "extracted": data, "doc_type": doc_type}