from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database import get_db, engine
from models import Base
from chatbot_groq import chat_groq
import json
import io

# ══════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════
class StockItem(Base):
    __tablename__ = "stock_items"
    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String(200), nullable=False)
    reference = Column(String(100), unique=True)
    categorie = Column(String(100))
    unite = Column(String(50), default="unité")
    quantite = Column(Float, default=0)
    quantite_min = Column(Float, default=5)
    prix_unitaire = Column(Float, default=0)
    fournisseur = Column(String(200))
    localisation = Column(String(100))
    description = Column(Text)
    actif = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class MouvementStock(Base):
    __tablename__ = "mouvements_stock"
    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("stock_items.id"))
    type_mouvement = Column(String(20))  # entree, sortie, ajustement
    quantite = Column(Float)
    motif = Column(String(200))
    projet_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# Create tables
Base.metadata.create_all(bind=engine)

router = APIRouter(prefix="/stock", tags=["stock"])

# ── Schemas ──────────────────────────────────────
class StockItemCreate(BaseModel):
    nom: str
    reference: Optional[str] = None
    categorie: Optional[str] = None
    unite: str = "unité"
    quantite: float = 0
    quantite_min: float = 5
    prix_unitaire: float = 0
    fournisseur: Optional[str] = None
    localisation: Optional[str] = None
    description: Optional[str] = None

class MouvementCreate(BaseModel):
    item_id: int
    type_mouvement: str
    quantite: float
    motif: Optional[str] = None
    projet_id: Optional[int] = None

# ── Routes CRUD ───────────────────────────────────
@router.get("/")
def get_stock(db: Session = Depends(get_db)):
    items = db.query(StockItem).filter(StockItem.actif == True).all()
    result = []
    for item in items:
        alerte = item.quantite <= item.quantite_min
        result.append({
            "id": item.id, "nom": item.nom, "reference": item.reference,
            "categorie": item.categorie, "unite": item.unite,
            "quantite": item.quantite, "quantite_min": item.quantite_min,
            "prix_unitaire": item.prix_unitaire, "fournisseur": item.fournisseur,
            "localisation": item.localisation, "description": item.description,
            "valeur_totale": round(item.quantite * item.prix_unitaire, 2),
            "alerte_stock": alerte,
            "created_at": str(item.created_at)
        })
    return result

@router.post("/")
def create_item(req: StockItemCreate, db: Session = Depends(get_db)):
    # Auto-generate reference if missing
    if not req.reference:
        count = db.query(StockItem).count()
        req.reference = f"REF-{count+1:04d}"

    item = StockItem(**req.dict())
    db.add(item); db.commit(); db.refresh(item)
    return {"id": item.id, "reference": item.reference, "message": "Article créé"}

@router.put("/{item_id}")
def update_item(item_id: int, req: StockItemCreate, db: Session = Depends(get_db)):
    item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not item: raise HTTPException(404, "Article introuvable")
    for k, v in req.dict(exclude_none=True).items():
        setattr(item, k, v)
    item.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Article mis à jour"}

@router.delete("/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not item: raise HTTPException(404, "Article introuvable")
    item.actif = False
    db.commit()
    return {"message": "Article supprimé"}

# ── Mouvements ────────────────────────────────────
@router.post("/mouvement")
def add_mouvement(req: MouvementCreate, db: Session = Depends(get_db)):
    item = db.query(StockItem).filter(StockItem.id == req.item_id).first()
    if not item: raise HTTPException(404, "Article introuvable")

    if req.type_mouvement == "entree":
        item.quantite += req.quantite
    elif req.type_mouvement == "sortie":
        if item.quantite < req.quantite:
            raise HTTPException(400, f"Stock insuffisant: {item.quantite} {item.unite} disponible")
        item.quantite -= req.quantite
    elif req.type_mouvement == "ajustement":
        item.quantite = req.quantite

    mouvement = MouvementStock(
        item_id=req.item_id, type_mouvement=req.type_mouvement,
        quantite=req.quantite, motif=req.motif, projet_id=req.projet_id
    )
    db.add(mouvement); db.commit()
    return {"message": "Mouvement enregistré", "nouvelle_quantite": item.quantite}

@router.get("/{item_id}/mouvements")
def get_mouvements(item_id: int, db: Session = Depends(get_db)):
    mvts = db.query(MouvementStock).filter(
        MouvementStock.item_id == item_id
    ).order_by(MouvementStock.created_at.desc()).limit(50).all()
    return [{"id":m.id, "type":m.type_mouvement, "quantite":m.quantite,
             "motif":m.motif, "date":str(m.created_at)} for m in mvts]

# ── Alertes stock ─────────────────────────────────
@router.get("/alertes/stock-bas")
def get_alertes_stock(db: Session = Depends(get_db)):
    items = db.query(StockItem).filter(
        StockItem.actif == True,
        StockItem.quantite <= StockItem.quantite_min
    ).all()
    return [{"id":i.id, "nom":i.nom, "quantite":i.quantite,
             "quantite_min":i.quantite_min, "unite":i.unite,
             "fournisseur":i.fournisseur} for i in items]

# ── Stats stock ───────────────────────────────────
@router.get("/stats/overview")
def get_stats_stock(db: Session = Depends(get_db)):
    items = db.query(StockItem).filter(StockItem.actif == True).all()
    valeur_totale = sum(i.quantite * i.prix_unitaire for i in items)
    alertes = sum(1 for i in items if i.quantite <= i.quantite_min)
    categories = {}
    for i in items:
        cat = i.categorie or "Non classé"
        categories[cat] = categories.get(cat, 0) + 1

    return {
        "total_articles": len(items),
        "valeur_totale": round(valeur_totale, 2),
        "valeur_formatted": f"{valeur_totale:,.0f} MAD",
        "alertes_stock_bas": alertes,
        "categories": [{"nom": k, "count": v} for k, v in categories.items()],
    }

# ── QR Code ───────────────────────────────────────
@router.get("/{item_id}/qrcode")
def get_qrcode(item_id: int, db: Session = Depends(get_db)):
    item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not item: raise HTTPException(404, "Article introuvable")
    try:
        import qrcode
        from io import BytesIO
        data = json.dumps({
            "id": item.id, "nom": item.nom,
            "reference": item.reference, "categorie": item.categorie,
            "prix_unitaire": item.prix_unitaire, "unite": item.unite,
            "fournisseur": item.fournisseur
        })
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return StreamingResponse(buf, media_type="image/png",
            headers={"Content-Disposition": f"inline; filename=qr_{item.reference}.png"})
    except ImportError:
        return {"error": "pip install qrcode[pil]", "data": data}

# ── IA Analysis ───────────────────────────────────
@router.get("/ia/analyse")
def ia_analyse_stock(db: Session = Depends(get_db)):
    items = db.query(StockItem).filter(StockItem.actif == True).all()
    if not items:
        return {"analyse": "Aucun article en stock pour analyser."}

    stock_summary = "\n".join([
        f"- {i.nom} (Réf: {i.reference}): {i.quantite} {i.unite} "
        f"(min: {i.quantite_min}) | Prix: {i.prix_unitaire} MAD | Cat: {i.categorie or 'N/A'}"
        for i in items[:30]
    ])

    valeur_totale = sum(i.quantite * i.prix_unitaire for i in items)
    alertes = [i for i in items if i.quantite <= i.quantite_min]

    prompt = f"""Tu es un expert en gestion de stock pour un bureau d'étude de construction au Maroc.

INVENTAIRE ACTUEL ({len(items)} articles):
{stock_summary}

VALEUR TOTALE: {valeur_totale:,.0f} MAD
ARTICLES EN ALERTE: {len(alertes)}

Donne une analyse concise (4-5 points) incluant:
1. État général du stock
2. Articles critiques à commander urgentement
3. Recommandations d'optimisation
4. Estimation budget réapprovisionnement
5. Conseil sur la gestion des fournisseurs

Réponds en français, de façon professionnelle et actionnable."""

    try:
        analyse = chat_groq(prompt)
        return {
            "analyse": analyse,
            "stats": {
                "total": len(items),
                "alertes": len(alertes),
                "valeur": f"{valeur_totale:,.0f} MAD"
            }
        }
    except Exception as e:
        return {"error": str(e)}

@router.post("/ia/scan-produit")
async def scan_produit(file: UploadFile = File(...)):
    """Scan un document produit et extrait les infos automatiquement."""
    content = await file.read()
    filename = file.filename.lower()

    # Extract text
    raw_text = ""
    if filename.endswith(".pdf"):
        try:
            import fitz
            import tempfile, os
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as f:
                f.write(content); path = f.name
            doc = fitz.open(path)
            for page in doc: raw_text += page.get_text()
            doc.close(); os.unlink(path)
        except: pass
    else:
        try:
            import pytesseract
            from PIL import Image
            from io import BytesIO
            img = Image.open(BytesIO(content))
            raw_text = pytesseract.image_to_string(img, lang="fra+eng")
        except: pass

    if not raw_text.strip():
        return {"success": False, "error": "Impossible d'extraire le texte"}

    prompt = f"""Extrait les informations d'un produit/article depuis ce document.

TEXTE:
{raw_text[:2000]}

Réponds UNIQUEMENT avec un JSON valide:
{{
  "nom": "string",
  "reference": "string ou null",
  "categorie": "string (ex: Matériaux, Outillage, Fournitures...)",
  "prix_unitaire": number ou null,
  "unite": "string (unité, kg, m², L...)",
  "fournisseur": "string ou null",
  "description": "string résumé",
  "confidence": number (0-100)
}}"""

    try:
        response = chat_groq(prompt)
        response = response.strip()
        if "```" in response:
            response = response.split("```")[1]
            if response.startswith("json"): response = response[4:]
        data = json.loads(response)
        return {"success": True, "extracted": data}
    except Exception as e:
        return {"success": False, "error": str(e), "raw": raw_text[:300]}