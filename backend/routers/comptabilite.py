from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Enum
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database import get_db, engine
from models import Base, Facture, Projet
from chatbot_groq import chat_groq
import enum

# ══════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════
class TypeEcriture(str, enum.Enum):
    debit = "debit"
    credit = "credit"

class EcritureComptable(Base):
    __tablename__ = "ecritures_comptables"
    id = Column(Integer, primary_key=True)
    date = Column(DateTime, default=datetime.utcnow)
    numero_piece = Column(String(100))
    compte = Column(String(50))        # ex: 411, 512, 706...
    libelle = Column(String(300))
    debit = Column(Float, default=0)
    credit = Column(Float, default=0)
    journal = Column(String(50))       # VT, BQ, AC, OD...
    projet_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class BudgetProjet(Base):
    __tablename__ = "budgets_projets"
    id = Column(Integer, primary_key=True)
    projet_id = Column(Integer, nullable=False)
    poste = Column(String(200))
    budget_prevu = Column(Float, default=0)
    budget_realise = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

router = APIRouter(prefix="/comptabilite", tags=["comptabilite"])

# ── Schemas ───────────────────────────────────────
class EcritureCreate(BaseModel):
    date: Optional[str] = None
    numero_piece: Optional[str] = None
    compte: str
    libelle: str
    debit: float = 0
    credit: float = 0
    journal: str = "OD"
    projet_id: Optional[int] = None

class BudgetCreate(BaseModel):
    projet_id: int
    poste: str
    budget_prevu: float
    budget_realise: float = 0

# ── Ecritures ─────────────────────────────────────
@router.get("/ecritures")
def get_ecritures(journal: str = None, db: Session = Depends(get_db)):
    q = db.query(EcritureComptable)
    if journal: q = q.filter(EcritureComptable.journal == journal)
    ecritures = q.order_by(EcritureComptable.date.desc()).limit(200).all()
    return [{
        "id": e.id, "date": str(e.date)[:10], "compte": e.compte,
        "libelle": e.libelle, "debit": e.debit, "credit": e.credit,
        "journal": e.journal, "numero_piece": e.numero_piece,
        "projet_id": e.projet_id
    } for e in ecritures]

@router.post("/ecritures")
def create_ecriture(req: EcritureCreate, db: Session = Depends(get_db)):
    ecriture = EcritureComptable(
        date=datetime.fromisoformat(req.date) if req.date else datetime.utcnow(),
        numero_piece=req.numero_piece,
        compte=req.compte, libelle=req.libelle,
        debit=req.debit, credit=req.credit,
        journal=req.journal, projet_id=req.projet_id
    )
    db.add(ecriture); db.commit(); db.refresh(ecriture)
    return {"id": ecriture.id, "message": "Écriture créée"}

# ── Balance ───────────────────────────────────────
@router.get("/balance")
def get_balance(db: Session = Depends(get_db)):
    ecritures = db.query(EcritureComptable).all()
    comptes = {}
    for e in ecritures:
        if e.compte not in comptes:
            comptes[e.compte] = {"compte": e.compte, "debit": 0, "credit": 0}
        comptes[e.compte]["debit"] += e.debit
        comptes[e.compte]["credit"] += e.credit

    balance = []
    for c, v in comptes.items():
        solde = v["debit"] - v["credit"]
        balance.append({
            "compte": c, "debit": round(v["debit"], 2),
            "credit": round(v["credit"], 2), "solde": round(solde, 2),
            "sens": "D" if solde >= 0 else "C"
        })
    balance.sort(key=lambda x: x["compte"])
    return balance

# ── Compte de résultat ────────────────────────────
@router.get("/compte-resultat")
def get_compte_resultat(db: Session = Depends(get_db)):
    factures = db.query(Facture).all()
    projets = db.query(Projet).all()

    # Produits
    ca_facture = sum(f.montant for f in factures if f.statut == "payee")
    ca_devis = sum(f.montant for f in factures if f.statut == "devis")

    # Charges simulées (30% du CA)
    charges_personnel = ca_facture * 0.25
    charges_exploitation = ca_facture * 0.15
    charges_financieres = ca_facture * 0.03

    total_produits = ca_facture
    total_charges = charges_personnel + charges_exploitation + charges_financieres
    resultat = total_produits - total_charges

    return {
        "produits": {
            "chiffre_affaires": round(ca_facture, 2),
            "devis_en_cours": round(ca_devis, 2),
            "total": round(total_produits, 2),
        },
        "charges": {
            "personnel": round(charges_personnel, 2),
            "exploitation": round(charges_exploitation, 2),
            "financieres": round(charges_financieres, 2),
            "total": round(total_charges, 2),
        },
        "resultat_net": round(resultat, 2),
        "marge": round((resultat / total_produits * 100) if total_produits > 0 else 0, 1),
        "formatted": {
            "ca": f"{ca_facture:,.0f} MAD",
            "resultat": f"{resultat:,.0f} MAD",
        }
    }

# ── Budget projets ────────────────────────────────
@router.get("/budgets")
def get_budgets(db: Session = Depends(get_db)):
    budgets = db.query(BudgetProjet).all()
    projets = db.query(Projet).all()
    projets_map = {p.id: p.titre for p in projets}

    return [{
        "id": b.id, "projet_id": b.projet_id,
        "projet_titre": projets_map.get(b.projet_id, f"Projet #{b.projet_id}"),
        "poste": b.poste, "budget_prevu": b.budget_prevu,
        "budget_realise": b.budget_realise,
        "ecart": round(b.budget_prevu - b.budget_realise, 2),
        "taux_realisation": round(b.budget_realise / b.budget_prevu * 100 if b.budget_prevu > 0 else 0, 1)
    } for b in budgets]

@router.post("/budgets")
def create_budget(req: BudgetCreate, db: Session = Depends(get_db)):
    budget = BudgetProjet(**req.dict())
    db.add(budget); db.commit()
    return {"message": "Budget créé"}

# ── KPIs financiers ───────────────────────────────
@router.get("/kpis")
def get_kpis(db: Session = Depends(get_db)):
    factures = db.query(Facture).all()
    projets = db.query(Projet).all()

    total_facture = sum(f.montant for f in factures)
    total_paye = sum(f.montant for f in factures if f.statut == "payee")
    total_impaye = sum(f.montant for f in factures if f.statut == "impayee")
    nb_projets = len(projets)
    projets_en_cours = sum(1 for p in projets if p.statut == "en_cours")

    taux_recouvrement = (total_paye / total_facture * 100) if total_facture > 0 else 0
    budget_moyen = sum(p.budget_estime or 0 for p in projets) / max(nb_projets, 1)

    return {
        "taux_recouvrement": round(taux_recouvrement, 1),
        "ca_total": f"{total_paye:,.0f} MAD",
        "impayés": f"{total_impaye:,.0f} MAD",
        "budget_moyen_projet": f"{budget_moyen:,.0f} MAD",
        "projets_actifs": projets_en_cours,
        "nb_factures": len(factures),
        "indicateurs": [
            {"label": "Taux de recouvrement", "value": f"{taux_recouvrement:.1f}%",
             "status": "bon" if taux_recouvrement > 80 else "moyen" if taux_recouvrement > 50 else "mauvais"},
            {"label": "CA encaissé", "value": f"{total_paye:,.0f} MAD", "status": "info"},
            {"label": "Créances clients", "value": f"{total_impaye:,.0f} MAD",
             "status": "danger" if total_impaye > 50000 else "ok"},
            {"label": "Budget moyen/projet", "value": f"{budget_moyen:,.0f} MAD", "status": "info"},
        ]
    }

# ── AUDIT IA ──────────────────────────────────────
@router.get("/audit-ia")
def audit_ia(db: Session = Depends(get_db)):
    factures = db.query(Facture).all()
    projets = db.query(Projet).all()
    ecritures = db.query(EcritureComptable).limit(50).all()

    total_ca = sum(f.montant for f in factures if f.statut == "payee")
    total_impaye = sum(f.montant for f in factures if f.statut == "impayee")
    nb_projets = len(projets)
    projets_en_cours = sum(1 for p in projets if p.statut == "en_cours")
    budget_total = sum(p.budget_estime or 0 for p in projets)

    context = f"""DONNÉES FINANCIÈRES DU BUREAU D'ÉTUDE:

Chiffre d'affaires encaissé: {total_ca:,.0f} MAD
Créances impayées: {total_impaye:,.0f} MAD
Taux recouvrement: {(total_ca/(total_ca+total_impaye)*100) if (total_ca+total_impaye) > 0 else 0:.1f}%

Projets total: {nb_projets}
Projets en cours: {projets_en_cours}
Budget total projets: {budget_total:,.0f} MAD

Factures émises: {len(factures)}
Factures payées: {sum(1 for f in factures if f.statut == 'payee')}
Factures impayées: {sum(1 for f in factures if f.statut == 'impayee')}

Écritures comptables: {len(ecritures)} enregistrements"""

    prompt = f"""Tu es un expert-comptable et auditeur financier spécialisé dans les bureaux d'études au Maroc.

{context}

Effectue un audit financier complet et donne:
1. DIAGNOSTIC GÉNÉRAL (santé financière globale)
2. POINTS FORTS identifiés
3. RISQUES ET ANOMALIES détectés
4. RECOMMANDATIONS PRIORITAIRES (3-5 actions concrètes)
5. INDICATEURS À SURVEILLER

Sois précis, chiffré, et professionnel. Réponds en français."""

    try:
        analyse = chat_groq(prompt)
        return {
            "audit": analyse,
            "date_audit": datetime.now().strftime("%d/%m/%Y %H:%M"),
            "score_sante": min(100, int((total_ca / max(total_ca + total_impaye, 1)) * 100)),
            "resume": {
                "ca": f"{total_ca:,.0f} MAD",
                "impayé": f"{total_impaye:,.0f} MAD",
                "projets": nb_projets
            }
        }
    except Exception as e:
        return {"error": str(e)}