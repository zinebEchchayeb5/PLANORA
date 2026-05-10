from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import Facture, Projet, Client
from datetime import datetime, timedelta
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/notifications", tags=["notifications"])

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
FROM_NAME = "PLANORA Bureau d'étude"


def send_email(to: str, subject: str, html: str) -> bool:
    """Envoie un email HTML."""
    if not SMTP_USER or not SMTP_PASS:
        print(f"[EMAIL] Config manquante — simule envoi à {to}: {subject}")
        return True  # Simulate success if no SMTP config

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{FROM_NAME} <{SMTP_USER}>"
        msg["To"] = to
        msg.attach(MIMEText(html, "html", "utf-8"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, to, msg.as_string())
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")
        return False


def email_template(title: str, body: str, cta_text: str = None, cta_url: str = None) -> str:
    """Template HTML email professionnel PLANORA."""
    cta_html = f"""
    <div style="text-align:center;margin:24px 0">
      <a href="{cta_url}" style="background:#1e293b;color:white;padding:12px 28px;
        border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
        {cta_text}
      </a>
    </div>""" if cta_text and cta_url else ""

    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:sans-serif">
  <div style="max-width:600px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.08)">
    <div style="background:#1e293b;padding:24px 32px">
      <div style="font-size:22px;font-weight:700;color:white;letter-spacing:1px">PLANORA</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">Bureau d'étude architectural</div>
    </div>
    <div style="padding:32px">
      <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b">{title}</h2>
      <div style="font-size:14px;line-height:1.7;color:#374151">{body}</div>
      {cta_html}
    </div>
    <div style="background:#f8fafc;padding:16px 32px;font-size:12px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0">
      PLANORA — Bureau d'étude architectural · {datetime.now().year}
    </div>
  </div>
</body>
</html>"""


# ══════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════

class EmailTest(BaseModel):
    to: str
    subject: str = "Test PLANORA"

@router.post("/test-email")
def test_email(req: EmailTest):
    """Teste l'envoi d'email."""
    html = email_template(
        "Test de notification PLANORA",
        "Bonjour! Ceci est un email de test de votre système PLANORA. La configuration email fonctionne correctement.",
        "Ouvrir PLANORA", "http://localhost:5173"
    )
    ok = send_email(req.to, req.subject, html)
    return {"success": ok, "message": "Email envoyé" if ok else "Erreur envoi"}


@router.post("/facture/{facture_id}/envoyer")
def envoyer_facture(facture_id: int, background_tasks: BackgroundTasks,
                    db: Session = Depends(get_db)):
    """Envoie la facture par email au client."""
    f = db.query(Facture).filter(Facture.id == facture_id).first()
    if not f:
        return {"success": False, "error": "Facture introuvable"}

    projet = db.query(Projet).filter(Projet.id == f.projet_id).first()
    client = db.query(Client).filter(Client.id == projet.client_id).first() if projet else None

    if not client or not client.email:
        return {"success": False, "error": "Client sans email"}

    type_doc = "Devis" if f.statut == "devis" else "Facture"
    body = f"""
    <p>Bonjour <strong>{client.nom}</strong>,</p>
    <p>Veuillez trouver ci-dessous les détails de votre {type_doc.lower()} :</p>
    <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:4px 0"><strong>N° :</strong> {type_doc} #{facture_id:04d}</p>
      <p style="margin:4px 0"><strong>Projet :</strong> {projet.titre if projet else '—'}</p>
      <p style="margin:4px 0"><strong>Montant :</strong> <span style="color:#1e293b;font-weight:700">{f.montant:,.0f} MAD</span></p>
      <p style="margin:4px 0"><strong>Statut :</strong> {f.statut.upper()}</p>
      {"<p style='margin:4px 0'><strong>Échéance :</strong> " + f.date_echeance.strftime('%d/%m/%Y') + "</p>" if f.date_echeance else ""}
    </div>
    <p>Pour toute question, n'hésitez pas à nous contacter.</p>
    <p>Cordialement,<br><strong>L'équipe PLANORA</strong></p>
    """

    html = email_template(f"{type_doc} N°{facture_id:04d}", body)
    background_tasks.add_task(send_email, client.email, f"{type_doc} PLANORA — {projet.titre if projet else ''}", html)
    return {"success": True, "message": f"Email envoyé à {client.email}"}


@router.post("/rappel-impayees")
def rappel_impayees(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Envoie des rappels pour les factures impayées > 30 jours."""
    limite = datetime.utcnow() - timedelta(days=30)
    factures = db.query(Facture).filter(
        Facture.statut == "impayee",
        Facture.date_emission < limite
    ).all()

    sent = 0
    for f in factures:
        projet = db.query(Projet).filter(Projet.id == f.projet_id).first()
        client = db.query(Client).filter(Client.id == projet.client_id).first() if projet else None
        if not client or not client.email:
            continue

        jours = (datetime.utcnow() - f.date_emission).days
        body = f"""
        <p>Bonjour <strong>{client.nom}</strong>,</p>
        <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:16px;margin:16px 0">
          <p style="margin:0;color:#991b1b;font-weight:600">⚠️ Rappel de paiement</p>
          <p style="margin:8px 0 4px"><strong>Facture :</strong> #{f.id:04d}</p>
          <p style="margin:4px 0"><strong>Montant :</strong> {f.montant:,.0f} MAD</p>
          <p style="margin:4px 0"><strong>En retard de :</strong> {jours} jours</p>
        </div>
        <p>Merci de régulariser cette situation dans les plus brefs délais.</p>
        """
        html = email_template("Rappel de paiement", body)
        background_tasks.add_task(send_email, client.email, f"Rappel paiement — Facture #{f.id:04d}", html)
        sent += 1

    return {"success": True, "rappels_envoyes": sent, "total_impayees": len(factures)}


@router.post("/deadline-projet/{projet_id}")
def notif_deadline(projet_id: int, background_tasks: BackgroundTasks,
                   db: Session = Depends(get_db)):
    """Notifie le responsable d'un projet proche de sa deadline."""
    p = db.query(Projet).filter(Projet.id == projet_id).first()
    if not p:
        return {"success": False, "error": "Projet introuvable"}

    client = db.query(Client).filter(Client.id == p.client_id).first()
    if not client or not client.email:
        return {"success": False, "error": "Pas d'email client"}

    body = f"""
    <p>Bonjour,</p>
    <p>Le projet <strong>{p.titre}</strong> approche de sa date limite.</p>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:4px 0"><strong>Projet :</strong> {p.titre}</p>
      <p style="margin:4px 0"><strong>Surface :</strong> {p.surface or '—'} m²</p>
      <p style="margin:4px 0"><strong>Statut :</strong> {p.statut}</p>
    </div>
    <p>Veuillez prendre les mesures nécessaires.</p>
    """
    html = email_template(f"Rappel deadline — {p.titre}", body)
    background_tasks.add_task(send_email, client.email, f"Deadline projet — {p.titre}", html)
    return {"success": True, "message": "Notification envoyée"}


@router.get("/config")
def get_email_config():
    """Vérifie la configuration email."""
    return {
        "configured": bool(SMTP_USER and SMTP_PASS),
        "smtp_host": SMTP_HOST,
        "smtp_user": SMTP_USER if SMTP_USER else "Non configuré",
        "instructions": "Ajoutez SMTP_USER et SMTP_PASS dans .env pour activer les emails réels"
    }