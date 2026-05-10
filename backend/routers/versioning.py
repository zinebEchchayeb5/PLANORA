from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database import get_db, engine
from models import Base, Projet
import json

class PlanVersion(Base):
    __tablename__ = "plan_versions"
    id = Column(Integer, primary_key=True, index=True)
    projet_id = Column(Integer, ForeignKey("projets.id"), nullable=True)
    version_number = Column(Integer, default=1)
    titre = Column(String(200))
    plan_json = Column(Text)
    cost_json = Column(Text)
    params_json = Column(Text)
    note = Column(String(500))
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

router = APIRouter(prefix="/versions", tags=["versioning"])

class SaveVersionRequest(BaseModel):
    projet_id: Optional[int] = None
    titre: Optional[str] = None
    plan: dict
    cost: Optional[dict] = None
    params: Optional[dict] = None
    note: Optional[str] = None
    created_by: Optional[str] = "Utilisateur"

@router.post("/save")
def save_version(req: SaveVersionRequest, db: Session = Depends(get_db)):
    # Get next version number for this projet
    last = db.query(PlanVersion).filter(
        PlanVersion.projet_id == req.projet_id
    ).order_by(PlanVersion.version_number.desc()).first()
    next_version = (last.version_number + 1) if last else 1

    version = PlanVersion(
        projet_id=req.projet_id,
        version_number=next_version,
        titre=req.titre or f"Plan v{next_version}",
        plan_json=json.dumps(req.plan),
        cost_json=json.dumps(req.cost) if req.cost else None,
        params_json=json.dumps(req.params) if req.params else None,
        note=req.note,
        created_by=req.created_by,
    )
    db.add(version); db.commit(); db.refresh(version)
    return {"id": version.id, "version_number": next_version, "message": f"Version {next_version} sauvegardée"}

@router.get("/projet/{projet_id}")
def get_versions_by_projet(projet_id: int, db: Session = Depends(get_db)):
    versions = db.query(PlanVersion).filter(
        PlanVersion.projet_id == projet_id
    ).order_by(PlanVersion.version_number.desc()).all()
    return _format_versions(versions)

@router.get("/all")
def get_all_versions(db: Session = Depends(get_db)):
    versions = db.query(PlanVersion).order_by(PlanVersion.created_at.desc()).limit(50).all()
    return _format_versions(versions)

@router.get("/{version_id}")
def get_version(version_id: int, db: Session = Depends(get_db)):
    v = db.query(PlanVersion).filter(PlanVersion.id == version_id).first()
    if not v: raise HTTPException(404, "Version introuvable")
    return _format_version(v, include_full=True)

@router.delete("/{version_id}")
def delete_version(version_id: int, db: Session = Depends(get_db)):
    v = db.query(PlanVersion).filter(PlanVersion.id == version_id).first()
    if not v: raise HTTPException(404, "Version introuvable")
    db.delete(v); db.commit()
    return {"message": "Version supprimée"}

@router.get("/compare/{v1_id}/{v2_id}")
def compare_versions(v1_id: int, v2_id: int, db: Session = Depends(get_db)):
    v1 = db.query(PlanVersion).filter(PlanVersion.id == v1_id).first()
    v2 = db.query(PlanVersion).filter(PlanVersion.id == v2_id).first()
    if not v1 or not v2: raise HTTPException(404, "Version introuvable")

    plan1 = json.loads(v1.plan_json)
    plan2 = json.loads(v2.plan_json)

    rooms1 = {r["name"]: r for r in plan1.get("rooms", [])}
    rooms2 = {r["name"]: r for r in plan2.get("rooms", [])}

    added = [r for name, r in rooms2.items() if name not in rooms1]
    removed = [r for name, r in rooms1.items() if name not in rooms2]
    modified = []
    for name in rooms1:
        if name in rooms2:
            r1, r2 = rooms1[name], rooms2[name]
            if r1.get("w") != r2.get("w") or r1.get("h") != r2.get("h"):
                modified.append({
                    "name": name,
                    "before": {"w": r1.get("w"), "h": r1.get("h"), "surface": r1.get("w",0)*r1.get("h",0)},
                    "after":  {"w": r2.get("w"), "h": r2.get("h"), "surface": r2.get("w",0)*r2.get("h",0)},
                })

    cost1 = json.loads(v1.cost_json) if v1.cost_json else {}
    cost2 = json.loads(v2.cost_json) if v2.cost_json else {}

    return {
        "v1": {"id": v1.id, "version": v1.version_number, "titre": v1.titre, "date": str(v1.created_at)[:10]},
        "v2": {"id": v2.id, "version": v2.version_number, "titre": v2.titre, "date": str(v2.created_at)[:10]},
        "differences": {
            "pieces_ajoutees": added,
            "pieces_supprimees": removed,
            "pieces_modifiees": modified,
            "total_changes": len(added) + len(removed) + len(modified),
        },
        "cout_v1": cost1.get("total_cost_formatted", "—"),
        "cout_v2": cost2.get("total_cost_formatted", "—"),
        "surface_v1": plan1.get("total_surface", 0),
        "surface_v2": plan2.get("total_surface", 0),
    }

def _format_version(v, include_full=False):
    data = {
        "id": v.id,
        "version_number": v.version_number,
        "titre": v.titre,
        "note": v.note,
        "created_by": v.created_by,
        "created_at": str(v.created_at)[:16],
        "projet_id": v.projet_id,
    }
    if include_full:
        data["plan"] = json.loads(v.plan_json) if v.plan_json else {}
        data["cost"] = json.loads(v.cost_json) if v.cost_json else {}
        data["params"] = json.loads(v.params_json) if v.params_json else {}
    else:
        plan = json.loads(v.plan_json) if v.plan_json else {}
        data["surface"] = plan.get("total_surface", 0)
        data["style"] = plan.get("style", "—")
        data["nb_pieces"] = len(plan.get("rooms", []))
        cost = json.loads(v.cost_json) if v.cost_json else {}
        data["cout"] = cost.get("total_cost_formatted", "—")
    return data

def _format_versions(versions):
    return [_format_version(v) for v in versions]