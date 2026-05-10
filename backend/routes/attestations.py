"""
Service Fait (Attestation) Model and API Endpoints
For handling attestations de service fait (work completion certificates)
"""
from flask import Blueprint, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from sqlalchemy import func
import json

db = SQLAlchemy()

# ============ MODEL ============
class ServiceFait(db.Model):
    __tablename__ = 'service_fait'
    
    id = db.Column(db.Integer, primary_key=True)
    projet_id = db.Column(db.Integer, db.ForeignKey('projets.id'), nullable=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    numero_objet_marche = db.Column(db.String(100), nullable=False, unique=True)
    nom_prestataire = db.Column(db.String(255), default="ZETA CONCEPT")
    lieu_edition = db.Column(db.String(255), default="Tinghir")
    date_edition = db.Column(db.Date, default=datetime.utcnow)
    date_debut = db.Column(db.Date, nullable=True)
    date_fin = db.Column(db.Date, nullable=True)
    prestations = db.Column(db.JSON, default=[])  # List of dicts: {description, unite, qte_mois, pu_ht, prix_ht}
    tva_pourcent = db.Column(db.Float, default=20.0)
    notes = db.Column(db.Text, nullable=True)
    statut = db.Column(db.String(50), default='brouillon')  # brouillon, finalisee, envoyee, signee
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relations
    projet = db.relationship('Projet', backref='service_faits')
    client = db.relationship('Client', backref='service_faits')
    
    def to_dict(self):
        return {
            'id': self.id,
            'projet_id': self.projet_id,
            'client_id': self.client_id,
            'numero_objet_marche': self.numero_objet_marche,
            'nom_prestataire': self.nom_prestataire,
            'lieu_edition': self.lieu_edition,
            'date_edition': self.date_edition.isoformat() if self.date_edition else None,
            'date_debut': self.date_debut.isoformat() if self.date_debut else None,
            'date_fin': self.date_fin.isoformat() if self.date_fin else None,
            'prestations': self.prestations or [],
            'tva_pourcent': self.tva_pourcent,
            'notes': self.notes,
            'statut': self.statut,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'projet': self.projet.to_dict() if self.projet else None,
            'client': self.client.to_dict() if self.client else None,
        }


# ============ BLUEPRINT ============
attestations_bp = Blueprint('attestations', __name__, url_prefix='/attestations')


# GET all attestations
@attestations_bp.route('/', methods=['GET'])
def get_attestations():
    """Get all attestations"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    statut = request.args.get('statut', None)
    
    query = ServiceFait.query
    
    if statut:
        query = query.filter_by(statut=statut)
    
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'data': [att.to_dict() for att in paginated.items],
        'total': paginated.total,
        'pages': paginated.pages,
        'current_page': page,
    }), 200


# GET single attestation
@attestations_bp.route('/<int:attestation_id>', methods=['GET'])
def get_attestation(attestation_id):
    """Get single attestation"""
    att = ServiceFait.query.get(attestation_id)
    if not att:
        return jsonify({'error': 'Attestation not found'}), 404
    return jsonify(att.to_dict()), 200


# CREATE attestation
@attestations_bp.route('/', methods=['POST'])
def create_attestation():
    """Create new attestation"""
    data = request.get_json()
    
    if not data.get('client_id'):
        return jsonify({'error': 'client_id is required'}), 400
    
    if not data.get('numero_objet_marche'):
        return jsonify({'error': 'numero_objet_marche is required'}), 400
    
    # Check uniqueness
    existing = ServiceFait.query.filter_by(numero_objet_marche=data['numero_objet_marche']).first()
    if existing:
        return jsonify({'error': 'This marche number already exists'}), 400
    
    try:
        att = ServiceFait(
            projet_id=data.get('projet_id'),
            client_id=data['client_id'],
            numero_objet_marche=data['numero_objet_marche'],
            nom_prestataire=data.get('nom_prestataire', 'ZETA CONCEPT'),
            lieu_edition=data.get('lieu_edition', 'Tinghir'),
            date_edition=datetime.fromisoformat(data['date_edition']) if data.get('date_edition') else datetime.utcnow(),
            date_debut=datetime.fromisoformat(data['date_debut']).date() if data.get('date_debut') else None,
            date_fin=datetime.fromisoformat(data['date_fin']).date() if data.get('date_fin') else None,
            prestations=data.get('prestations', []),
            tva_pourcent=float(data.get('tva_pourcent', 20)),
            notes=data.get('notes'),
            statut=data.get('statut', 'brouillon'),
        )
        
        db.session.add(att)
        db.session.commit()
        
        return jsonify({
            'message': 'Attestation created',
            'attestation': att.to_dict()
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# UPDATE attestation
@attestations_bp.route('/<int:attestation_id>', methods=['PUT'])
def update_attestation(attestation_id):
    """Update attestation"""
    att = ServiceFait.query.get(attestation_id)
    if not att:
        return jsonify({'error': 'Attestation not found'}), 404
    
    data = request.get_json()
    
    try:
        if 'statut' in data:
            att.statut = data['statut']
        if 'prestations' in data:
            att.prestations = data['prestations']
        if 'notes' in data:
            att.notes = data['notes']
        if 'tva_pourcent' in data:
            att.tva_pourcent = float(data['tva_pourcent'])
        if 'date_fin' in data:
            att.date_fin = datetime.fromisoformat(data['date_fin']).date() if data['date_fin'] else None
        
        att.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Attestation updated',
            'attestation': att.to_dict()
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# DELETE attestation
@attestations_bp.route('/<int:attestation_id>', methods=['DELETE'])
def delete_attestation(attestation_id):
    """Delete attestation"""
    att = ServiceFait.query.get(attestation_id)
    if not att:
        return jsonify({'error': 'Attestation not found'}), 404
    
    try:
        db.session.delete(att)
        db.session.commit()
        return jsonify({'message': 'Attestation deleted'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# STATS
@attestations_bp.route('/stats', methods=['GET'])
def get_stats():
    """Get attestation statistics"""
    total = db.session.query(func.count(ServiceFait.id)).scalar()
    finalisees = db.session.query(func.count(ServiceFait.id)).filter_by(statut='finalisee').scalar()
    envoyees = db.session.query(func.count(ServiceFait.id)).filter_by(statut='envoyee').scalar()
    signees = db.session.query(func.count(ServiceFait.id)).filter_by(statut='signee').scalar()
    
    # Calculate total revenue from all attestations
    attestations = ServiceFait.query.all()
    total_revenue = 0
    for att in attestations:
        for prestation in att.prestations or []:
            total_revenue += prestation.get('prix_ht', 0)
    
    tva_total = sum([
        (att.tva_pourcent / 100) * sum([p.get('prix_ht', 0) for p in (att.prestations or [])])
        for att in attestations
    ])
    
    return jsonify({
        'total': total,
        'finalisees': finalisees,
        'envoyees': envoyees,
        'signees': signees,
        'total_revenue_ht': total_revenue,
        'total_tva': tva_total,
        'total_revenue_ttc': total_revenue + tva_total,
    }), 200
