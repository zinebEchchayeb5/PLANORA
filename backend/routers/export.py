from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database import get_db
from models import Projet, Client, Facture
from io import BytesIO
from datetime import datetime

router = APIRouter(prefix="/export", tags=["export"])

def get_reportlab():
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        return True
    except ImportError:
        return False

# ══════════════════════════════════════════════════
# EXPORT FACTURE PDF
# ══════════════════════════════════════════════════
@router.get("/facture/{facture_id}")
def export_facture(facture_id: int, db: Session = Depends(get_db)):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm

    f = db.query(Facture).filter(Facture.id == facture_id).first()
    if not f:
        return {"error": "Facture introuvable"}

    projet = db.query(Projet).filter(Projet.id == f.projet_id).first()
    client = db.query(Client).filter(Client.id == projet.client_id).first() if projet else None

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)

    styles = getSampleStyleSheet()
    story = []

    # Header
    header_style = ParagraphStyle("header", fontSize=24, fontName="Helvetica-Bold",
        textColor=colors.HexColor("#1e293b"), spaceAfter=4)
    sub_style = ParagraphStyle("sub", fontSize=10, textColor=colors.HexColor("#64748b"), spaceAfter=2)
    title_style = ParagraphStyle("title", fontSize=14, fontName="Helvetica-Bold",
        textColor=colors.HexColor("#1e293b"), spaceBefore=10, spaceAfter=6)
    normal_style = ParagraphStyle("normal", fontSize=10, textColor=colors.HexColor("#374151"), spaceAfter=4)

    story.append(Paragraph("PLANORA", header_style))
    story.append(Paragraph("Bureau d'étude architectural", sub_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#1e293b"), spaceAfter=16))

    # Titre facture
    type_label = "DEVIS" if f.statut == "devis" else "FACTURE"
    story.append(Paragraph(f"{type_label} N° {f.id:04d}", title_style))
    story.append(Paragraph(f"Date d'émission: {datetime.now().strftime('%d/%m/%Y')}", normal_style))
    if f.date_echeance:
        story.append(Paragraph(f"Date d'échéance: {f.date_echeance.strftime('%d/%m/%Y')}", normal_style))
    story.append(Spacer(1, 0.5*cm))

    # Infos client
    if client:
        story.append(Paragraph("DESTINATAIRE", ParagraphStyle("sec", fontSize=10, fontName="Helvetica-Bold",
            textColor=colors.HexColor("#64748b"), spaceBefore=8, spaceAfter=4)))
        story.append(Paragraph(f"<b>{client.nom}</b>", normal_style))
        if client.email: story.append(Paragraph(client.email, normal_style))
        if client.telephone: story.append(Paragraph(client.telephone, normal_style))
        if client.adresse: story.append(Paragraph(client.adresse, normal_style))
        story.append(Spacer(1, 0.5*cm))

    # Projet
    if projet:
        story.append(Paragraph("PROJET", ParagraphStyle("sec2", fontSize=10, fontName="Helvetica-Bold",
            textColor=colors.HexColor("#64748b"), spaceBefore=8, spaceAfter=4)))
        story.append(Paragraph(f"<b>{projet.titre}</b>", normal_style))
        if projet.type_bien: story.append(Paragraph(f"Type: {projet.type_bien}", normal_style))
        if projet.surface: story.append(Paragraph(f"Surface: {projet.surface} m²", normal_style))
        story.append(Spacer(1, 0.5*cm))

    # Tableau montants
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0"), spaceAfter=8))

    tva_rate = 20
    montant_ht = f.montant
    tva_amt = montant_ht * tva_rate / 100
    ttc = montant_ht + tva_amt

    data = [
        ["Description", "Montant HT"],
        [f"Honoraires — {projet.titre if projet else 'Prestation'}", f"{montant_ht:,.0f} MAD"],
        ["", ""],
        ["Sous-total HT", f"{montant_ht:,.0f} MAD"],
        [f"TVA ({tva_rate}%)", f"{tva_amt:,.0f} MAD"],
        ["TOTAL TTC", f"{ttc:,.0f} MAD"],
    ]

    t = Table(data, colWidths=[12*cm, 5*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 10),
        ("ALIGN", (1,0), (1,-1), "RIGHT"),
        ("ROWBACKGROUNDS", (0,1), (-1,-4), [colors.white, colors.HexColor("#f8fafc")]),
        ("FONTNAME", (0,-1), (-1,-1), "Helvetica-Bold"),
        ("BACKGROUND", (0,-1), (-1,-1), colors.HexColor("#f0fdf4")),
        ("TEXTCOLOR", (0,-1), (-1,-1), colors.HexColor("#166534")),
        ("LINEBELOW", (0,-3), (-1,-3), 1, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0,0), (-1,-1), 8),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("LEFTPADDING", (0,0), (-1,-1), 10),
    ]))
    story.append(t)
    story.append(Spacer(1, 1*cm))

    # Statut
    statut_colors = {"payee":"#166534", "impayee":"#991b1b", "devis":"#1d4ed8"}
    story.append(Paragraph(
        f'Statut: <font color="{statut_colors.get(f.statut,"#374151")}"><b>{f.statut.upper()}</b></font>',
        ParagraphStyle("statut", fontSize=11, spaceAfter=8)
    ))

    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0"), spaceBefore=16))
    story.append(Paragraph("Merci pour votre confiance — PLANORA Bureau d'étude",
        ParagraphStyle("footer", fontSize=9, textColor=colors.HexColor("#94a3b8"), alignment=1)))

    doc.build(story)
    buf.seek(0)

    return StreamingResponse(buf, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=facture_{f.id:04d}.pdf"})


# ══════════════════════════════════════════════════
# EXPORT RAPPORT PROJET PDF
# ══════════════════════════════════════════════════
@router.post("/rapport-pdf")
def export_rapport_pdf(data: dict, db: Session = Depends(get_db)):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm

    titre = data.get("titre", "Rapport de projet")
    rapport_text = data.get("rapport", "")
    plan = data.get("plan", {})

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)

    styles = getSampleStyleSheet()
    story = []

    h1 = ParagraphStyle("h1", fontSize=22, fontName="Helvetica-Bold",
        textColor=colors.HexColor("#1e293b"), spaceAfter=4)
    h2 = ParagraphStyle("h2", fontSize=13, fontName="Helvetica-Bold",
        textColor=colors.HexColor("#3B82F6"), spaceBefore=14, spaceAfter=6)
    normal = ParagraphStyle("normal", fontSize=10, textColor=colors.HexColor("#374151"),
        spaceAfter=6, leading=15)
    small = ParagraphStyle("small", fontSize=9, textColor=colors.HexColor("#64748b"), spaceAfter=4)

    # Header
    story.append(Paragraph("PLANORA", h1))
    story.append(Paragraph("Bureau d'étude architectural — Rapport technique", small))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#1e293b"), spaceAfter=12))
    story.append(Paragraph(titre, ParagraphStyle("titre", fontSize=16, fontName="Helvetica-Bold",
        textColor=colors.HexColor("#1e293b"), spaceAfter=4)))
    story.append(Paragraph(f"Généré le {datetime.now().strftime('%d/%m/%Y à %H:%M')}",
        ParagraphStyle("date", fontSize=9, textColor=colors.HexColor("#94a3b8"), spaceAfter=16)))

    # Infos plan
    if plan:
        story.append(Paragraph("INFORMATIONS DU PROJET", h2))
        rooms = plan.get("rooms", [])
        info_data = [
            ["Paramètre", "Valeur"],
            ["Type de bien", plan.get("context", {}).get("type_bien", "—")],
            ["Style architectural", plan.get("style", "—")],
            ["Surface totale", f"{plan.get('total_surface', '—')} m²"],
            ["Nombre de pièces", str(len(rooms))],
            ["Layout", plan.get("layout", "—")],
        ]
        t = Table(info_data, colWidths=[7*cm, 10*cm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0,0), (-1,0), colors.white),
            ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
            ("FONTSIZE", (0,0), (-1,-1), 10),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
            ("TOPPADDING", (0,0), (-1,-1), 7),
            ("BOTTOMPADDING", (0,0), (-1,-1), 7),
            ("LEFTPADDING", (0,0), (-1,-1), 10),
            ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ]))
        story.append(t)
        story.append(Spacer(1, 0.5*cm))

        # Tableau pièces
        if rooms:
            story.append(Paragraph("DÉTAIL DES ESPACES", h2))
            room_data = [["Pièce", "Largeur", "Profondeur", "Surface", "Type"]]
            for r in rooms:
                s = round(r.get("w", 0) * r.get("h", 0), 1)
                room_data.append([
                    r.get("name","—"),
                    f"{r.get('w','—')} m",
                    f"{r.get('h','—')} m",
                    f"{s} m²",
                    r.get("type","—")
                ])
            rt = Table(room_data, colWidths=[5*cm, 3*cm, 3*cm, 3*cm, 3*cm])
            rt.setStyle(TableStyle([
                ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#3B82F6")),
                ("TEXTCOLOR", (0,0), (-1,0), colors.white),
                ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
                ("FONTSIZE", (0,0), (-1,-1), 9),
                ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
                ("TOPPADDING", (0,0), (-1,-1), 6),
                ("BOTTOMPADDING", (0,0), (-1,-1), 6),
                ("LEFTPADDING", (0,0), (-1,-1), 8),
                ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
            ]))
            story.append(rt)
            story.append(Spacer(1, 0.5*cm))

    # Rapport IA
    if rapport_text:
        story.append(Paragraph("RAPPORT TECHNIQUE IA", h2))
        # Split by lines
        for line in rapport_text.split("\n"):
            line = line.strip()
            if not line:
                story.append(Spacer(1, 0.2*cm))
                continue
            if line.startswith("#") or line.isupper():
                story.append(Paragraph(line.replace("#","").strip(),
                    ParagraphStyle("sec", fontSize=11, fontName="Helvetica-Bold",
                        textColor=colors.HexColor("#1e293b"), spaceBefore=10, spaceAfter=4)))
            else:
                story.append(Paragraph(line, normal))

    # Footer
    story.append(Spacer(1, 1*cm))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0")))
    story.append(Paragraph("PLANORA — Bureau d'étude architectural — Document généré automatiquement",
        ParagraphStyle("footer", fontSize=8, textColor=colors.HexColor("#94a3b8"),
            alignment=1, spaceBefore=8)))

    doc.build(story)
    buf.seek(0)

    filename = titre.replace(" ", "_").replace("/", "-")
    return StreamingResponse(buf, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}.pdf"})