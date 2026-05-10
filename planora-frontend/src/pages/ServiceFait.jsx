import { useState, useEffect } from "react";
import { generateServiceFaitPDF } from "../utils/generateServiceFaitPDF";

const API = "http://127.0.0.1:8000";

const STATUT_COLORS = {
  brouillon: { bg: "#F3F4F6", text: "#6B7280", label: "Brouillon", dot: "#9CA3AF" },
  finalisee: { bg: "#F0FDF4", text: "#166534", label: "Finalisée", dot: "#10B981" },
  envoyee: { bg: "#EFF6FF", text: "#1D4ED8", label: "Envoyée", dot: "#3B82F6" },
  signee: { bg: "#FEF3C7", text: "#92400E", label: "Signée", dot: "#F59E0B" },
};

export default function ServiceFait() {
  const [attestations, setAttestations] = useState([]);
  const [projets, setProjets] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("all");
  const [view, setView] = useState("cards");

  const [form, setForm] = useState({
    projet_id: "",
    client_id: "",
    numero_objet_marche: "",
    nom_prestataire: "ZETA CONCEPT",
    lieu_edition: "Tinghir",
    date_edition: new Date().toISOString().split("T")[0],
    date_debut: "",
    date_fin: "",
    prestations: [{ description: "", unite: "", qte_mois: 0, pu_ht: 0, prix_ht: 0 }],
    tva_pourcent: 20,
    notes: "",
    statut: "brouillon",
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [att, proj, cli] = await Promise.all([
        fetch(`${API}/attestations/`).then(r => r.json()).catch(() => []),
        fetch(`${API}/projets/`).then(r => r.json()).catch(() => []),
        fetch(`${API}/clients/`).then(r => r.json()).catch(() => []),
      ]);
      setAttestations(Array.isArray(att) ? att : []);
      setProjets(Array.isArray(proj) ? proj : []);
      setClients(Array.isArray(cli) ? cli : []);
    } catch (e) {
      console.error("Erreur chargement:", e);
    }
    setLoading(false);
  };

  const save = async () => {
    if (!form.numero_objet_marche.trim()) return alert("Numéro de marché obligatoire");
    if (!form.projet_id && !form.client_id) return alert("Veuillez sélectionner un projet ou client");

    const body = {
      ...form,
      projet_id: form.projet_id ? +form.projet_id : null,
      client_id: form.client_id ? +form.client_id : null,
      prestations: form.prestations.map(p => ({
        ...p,
        qte_mois: +p.qte_mois || 0,
        pu_ht: +p.pu_ht || 0,
        prix_ht: +p.prix_ht || 0,
      })),
      tva_pourcent: +form.tva_pourcent || 20,
    };

    try {
      const res = await fetch(`${API}/attestations/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowForm(false);
        resetForm();
        fetchData();
        alert("Attestation créée avec succès!");
      }
    } catch (e) {
      console.error("Erreur:", e);
      alert("Erreur lors de la création");
    }
  };

  const resetForm = () => {
    setForm({
      projet_id: "",
      client_id: "",
      numero_objet_marche: "",
      nom_prestataire: "ZETA CONCEPT",
      lieu_edition: "Tinghir",
      date_edition: new Date().toISOString().split("T")[0],
      date_debut: "",
      date_fin: "",
      prestations: [{ description: "", unite: "", qte_mois: 0, pu_ht: 0, prix_ht: 0 }],
      tva_pourcent: 20,
      notes: "",
      statut: "brouillon",
    });
  };

  const del = async (id) => {
    if (!confirm("Supprimer cette attestation?")) return;
    try {
      await fetch(`${API}/attestations/${id}`, { method: "DELETE" });
      fetchData();
    } catch (e) {
      console.error("Erreur:", e);
    }
  };

  const updateStatut = async (id, statut) => {
    try {
      await fetch(`${API}/attestations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut }),
      });
      fetchData();
    } catch (e) {
      console.error("Erreur:", e);
    }
  };

  const addPrestation = () => {
    setForm({
      ...form,
      prestations: [...form.prestations, { description: "", unite: "", qte_mois: 0, pu_ht: 0, prix_ht: 0 }],
    });
  };

  const updatePrestation = (idx, field, value) => {
    const updated = [...form.prestations];
    updated[idx][field] = value;

    if (field === "pu_ht" || field === "qte_mois") {
      updated[idx].prix_ht = (parseFloat(updated[idx].pu_ht) || 0) * (parseFloat(updated[idx].qte_mois) || 0);
    }

    setForm({ ...form, prestations: updated });
  };

  const removePrestation = (idx) => {
    setForm({
      ...form,
      prestations: form.prestations.filter((_, i) => i !== idx),
    });
  };

  const calculateTotals = (prestations, tva) => {
    const totalHT = prestations.reduce((s, p) => s + (parseFloat(p.prix_ht) || 0), 0);
    const montantTVA = (totalHT * parseFloat(tva)) / 100;
    const totalTTC = totalHT + montantTVA;
    return { totalHT, montantTVA, totalTTC };
  };

  const generatePDF = async (att) => {
    try {
      const projet = projets.find(p => p.id === att.projet_id);
      const client = clients.find(c => c.id === att.client_id);

      const dataForPDF = {
        numero_objet_marche: att.numero_objet_marche,
        nom_prestataire: att.nom_prestataire,
        lieu_edition: att.lieu_edition,
        date_edition: att.date_edition,
        date_debut: att.date_debut,
        date_fin: att.date_fin,
        prestations: att.prestations,
        tva_pourcent: att.tva_pourcent,
        notes: att.notes,
        projet: projet,
        client: client,
      };

      generateServiceFaitPDF(dataForPDF);
    } catch (e) {
      console.error("Erreur PDF:", e);
      alert("Erreur lors de la génération du PDF");
    }
  };

  const filtered = attestations.filter(a =>
    (filterStatut === "all" || a.statut === filterStatut) &&
    (a.numero_objet_marche.toLowerCase().includes(search.toLowerCase()) ||
      a.nom_prestataire.toLowerCase().includes(search.toLowerCase()))
  );

  const stats = {
    total: attestations.length,
    finalisees: attestations.filter(a => a.statut === "finalisee").length,
    envoyees: attestations.filter(a => a.statut === "envoyee").length,
    signees: attestations.filter(a => a.statut === "signee").length,
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#1e293b" }}>📋 Attestations de Service Fait</h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 14 }}>
            {attestations.length} attestation{attestations.length !== 1 ? "s" : ""} au total
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: "9px 18px",
            background: "#1e293b",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          + Nouvelle attestation
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Total", value: stats.total, color: "#1e293b", icon: "📋" },
          { label: "Finalisées", value: stats.finalisees, color: "#10B981", icon: "✅" },
          { label: "Envoyées", value: stats.envoyees, color: "#3B82F6", icon: "📤" },
          { label: "Signées", value: stats.signees, color: "#F59E0B", icon: "✍️" },
        ].map(s => (
          <div key={s.label} style={{ background: "white", borderRadius: 12, padding: 18, border: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: 22 }}>{s.icon}</span>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color, marginTop: 8 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Formulaire */}
      {showForm && (
        <div style={{ background: "white", borderRadius: 12, padding: 20, border: "1px solid #e2e8f0", marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15 }}>Créer une attestation de service fait</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: "#64748b" }}>Projet (optionnel)</label>
              <select
                value={form.projet_id}
                onChange={e => {
                  const projId = e.target.value;
                  setForm({ ...form, projet_id: projId });
                  const proj = projets.find(p => p.id === +projId);
                  if (proj && proj.client) setForm(f => ({ ...f, client_id: proj.client.id }));
                }}
                style={{
                  width: "100%",
                  marginTop: 3,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  boxSizing: "border-box",
                  fontSize: 13,
                }}
              >
                <option value="">-- Sélectionner un projet --</option>
                {projets.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.titre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#64748b" }}>Client *</label>
              <select
                value={form.client_id}
                onChange={e => setForm({ ...form, client_id: e.target.value })}
                style={{
                  width: "100%",
                  marginTop: 3,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  boxSizing: "border-box",
                  fontSize: 13,
                }}
              >
                <option value="">-- Sélectionner un client --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#64748b" }}>Numéro de marché *</label>
              <input
                type="text"
                value={form.numero_objet_marche}
                onChange={e => setForm({ ...form, numero_objet_marche: e.target.value })}
                placeholder="Ex: M-2025-001"
                style={{
                  width: "100%",
                  marginTop: 3,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  boxSizing: "border-box",
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#64748b" }}>Nom du prestataire</label>
              <input
                type="text"
                value={form.nom_prestataire}
                onChange={e => setForm({ ...form, nom_prestataire: e.target.value })}
                style={{
                  width: "100%",
                  marginTop: 3,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  boxSizing: "border-box",
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#64748b" }}>Lieu d'édition</label>
              <input
                type="text"
                value={form.lieu_edition}
                onChange={e => setForm({ ...form, lieu_edition: e.target.value })}
                style={{
                  width: "100%",
                  marginTop: 3,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  boxSizing: "border-box",
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#64748b" }}>Date d'édition</label>
              <input
                type="date"
                value={form.date_edition}
                onChange={e => setForm({ ...form, date_edition: e.target.value })}
                style={{
                  width: "100%",
                  marginTop: 3,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  boxSizing: "border-box",
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#64748b" }}>Date début</label>
              <input
                type="date"
                value={form.date_debut}
                onChange={e => setForm({ ...form, date_debut: e.target.value })}
                style={{
                  width: "100%",
                  marginTop: 3,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  boxSizing: "border-box",
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#64748b" }}>Date fin</label>
              <input
                type="date"
                value={form.date_fin}
                onChange={e => setForm({ ...form, date_fin: e.target.value })}
                style={{
                  width: "100%",
                  marginTop: 3,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  boxSizing: "border-box",
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#64748b" }}>TVA (%)</label>
              <input
                type="number"
                value={form.tva_pourcent}
                onChange={e => setForm({ ...form, tva_pourcent: e.target.value })}
                style={{
                  width: "100%",
                  marginTop: 3,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  boxSizing: "border-box",
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          {/* Prestations */}
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: "0 0 12px", fontSize: 13, color: "#1e293b" }}>Détails des prestations</h4>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ textAlign: "left", padding: "8px", color: "#64748b" }}>Description</th>
                    <th style={{ textAlign: "left", padding: "8px", color: "#64748b" }}>Unité</th>
                    <th style={{ textAlign: "center", padding: "8px", color: "#64748b", width: 80 }}>Qté (mois)</th>
                    <th style={{ textAlign: "center", padding: "8px", color: "#64748b", width: 100 }}>P.U HT (MAD)</th>
                    <th style={{ textAlign: "center", padding: "8px", color: "#64748b", width: 100 }}>Prix HT (MAD)</th>
                    <th style={{ textAlign: "center", padding: "8px", color: "#64748b", width: 60 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {form.prestations.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "white" : "#fafafa" }}>
                      <td style={{ padding: "8px" }}>
                        <input
                          type="text"
                          value={p.description}
                          onChange={e => updatePrestation(idx, "description", e.target.value)}
                          placeholder="Description de la prestation"
                          style={{
                            width: "100%",
                            padding: "4px 6px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            fontSize: 12,
                            boxSizing: "border-box",
                          }}
                        />
                      </td>
                      <td style={{ padding: "8px" }}>
                        <select
                          value={p.unite}
                          onChange={e => updatePrestation(idx, "unite", e.target.value)}
                          style={{
                            width: "100%",
                            padding: "4px 6px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            fontSize: 12,
                            boxSizing: "border-box",
                          }}
                        >
                          <option value="">--</option>
                          <option value="jour">Jour</option>
                          <option value="mois">Mois</option>
                          <option value="HT">HT</option>
                          <option value="Forfait">Forfait</option>
                        </select>
                      </td>
                      <td style={{ padding: "8px", textAlign: "center" }}>
                        <input
                          type="number"
                          value={p.qte_mois}
                          onChange={e => updatePrestation(idx, "qte_mois", e.target.value)}
                          min="0"
                          step="0.5"
                          style={{
                            width: "100%",
                            padding: "4px 6px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            fontSize: 12,
                            boxSizing: "border-box",
                          }}
                        />
                      </td>
                      <td style={{ padding: "8px", textAlign: "center" }}>
                        <input
                          type="number"
                          value={p.pu_ht}
                          onChange={e => updatePrestation(idx, "pu_ht", e.target.value)}
                          min="0"
                          step="100"
                          style={{
                            width: "100%",
                            padding: "4px 6px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            fontSize: 12,
                            boxSizing: "border-box",
                          }}
                        />
                      </td>
                      <td style={{ padding: "8px", textAlign: "center", color: "#1e293b", fontWeight: 600 }}>
                        {p.prix_ht.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: "8px", textAlign: "center" }}>
                        <button
                          onClick={() => removePrestation(idx)}
                          style={{
                            padding: "4px 8px",
                            background: "#FEF2F2",
                            color: "#dc2626",
                            border: "1px solid #FECACA",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 11,
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={addPrestation}
              style={{
                marginTop: 8,
                padding: "6px 12px",
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                color: "#64748b",
              }}
            >
              + Ajouter une ligne
            </button>

            {/* Totaux */}
            {(() => {
              const { totalHT, montantTVA, totalTTC } = calculateTotals(form.prestations, form.tva_pourcent);
              return (
                <div style={{ marginTop: 12, textAlign: "right", fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 20 }}>
                    <div>
                      <span style={{ color: "#64748b" }}>Total HT:</span>
                      <span style={{ marginLeft: 8, fontWeight: 600, color: "#1e293b" }}>
                        {totalHT.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} MAD
                      </span>
                    </div>
                    <div>
                      <span style={{ color: "#64748b" }}>TVA {form.tva_pourcent}%:</span>
                      <span style={{ marginLeft: 8, fontWeight: 600, color: "#1e293b" }}>
                        {montantTVA.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} MAD
                      </span>
                    </div>
                    <div>
                      <span style={{ color: "#64748b" }}>Total TTC:</span>
                      <span style={{ marginLeft: 8, fontWeight: 600, fontSize: 14, color: "#8B5CF6" }}>
                        {totalTTC.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} MAD
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: "#64748b" }}>Notes/Observations</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2}
              style={{
                width: "100%",
                marginTop: 3,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                boxSizing: "border-box",
                fontSize: 13,
                resize: "vertical",
              }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={save}
              style={{
                padding: "8px 18px",
                background: "#1e293b",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Créer l'attestation
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              style={{
                padding: "8px 18px",
                background: "#f1f5f9",
                color: "#333",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher..."
          style={{
            padding: "7px 12px",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            fontSize: 13,
            width: 200,
          }}
        />
        {[
          ["all", "Tous"],
          ["brouillon", "Brouillons"],
          ["finalisee", "Finalisées"],
          ["envoyee", "Envoyées"],
          ["signee", "Signées"],
        ].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilterStatut(v)}
            style={{
              padding: "5px 14px",
              borderRadius: 20,
              border: "1px solid #e2e8f0",
              fontSize: 12,
              cursor: "pointer",
              background: filterStatut === v ? "#1e293b" : "white",
              color: filterStatut === v ? "white" : "#64748b",
            }}
          >
            {l}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {[
            ["cards", "⊞"],
            ["list", "☰"],
          ].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: "5px 10px",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                fontSize: 14,
                cursor: "pointer",
                background: view === v ? "#1e293b" : "white",
                color: view === v ? "white" : "#64748b",
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* CARDS VIEW */}
      {!loading && view === "cards" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px,1fr))", gap: 16 }}>
          {filtered.length === 0 ? (
            <div
              style={{
                background: "white",
                borderRadius: 12,
                padding: 40,
                border: "1px solid #e2e8f0",
                textAlign: "center",
                color: "#94a3b8",
                gridColumn: "1/-1",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
              <p>Aucune attestation trouvée</p>
            </div>
          ) : (
            filtered.map(att => (
              <div
                key={att.id}
                style={{
                  background: "white",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "all .2s",
                  borderTop: `3px solid ${STATUT_COLORS[att.statut]?.dot || "#e2e8f0"}`,
                }}
                onClick={() => setSelected(selected?.id === att.id ? null : att)}
              >
                <div style={{ padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{att.numero_objet_marche}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{att.nom_prestataire}</div>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: 8,
                        background: STATUT_COLORS[att.statut]?.bg,
                        color: STATUT_COLORS[att.statut]?.text,
                      }}
                    >
                      {STATUT_COLORS[att.statut]?.label}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
                    {att.date_debut && att.date_fin && (
                      <div>
                        📅 Du {new Date(att.date_debut).toLocaleDateString("fr-FR")} au{" "}
                        {new Date(att.date_fin).toLocaleDateString("fr-FR")}
                      </div>
                    )}
                    {att.prestations && att.prestations.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        {att.prestations.length} prestation{att.prestations.length !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>

                  {selected?.id === att.id && (
                    <div style={{ background: "#f8f9fa", borderRadius: 8, padding: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
                        <strong>Détails:</strong>
                      </div>
                      <div style={{ fontSize: 12, color: "#374151", lineHeight: "1.6" }}>
                        <div>📍 Lieu: {att.lieu_edition}</div>
                        <div>📅 Édition: {new Date(att.date_edition).toLocaleDateString("fr-FR")}</div>
                        {att.prestations && att.prestations.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Prestations:</div>
                            {att.prestations.map((p, i) => (
                              <div key={i} style={{ fontSize: 11, marginLeft: 8, marginBottom: 2 }}>
                                • {p.description} - {p.prix_ht.toLocaleString("fr-FR")} MAD
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div
                  style={{
                    padding: "10px 18px",
                    borderTop: "1px solid #f1f5f9",
                    display: "flex",
                    gap: 6,
                    background: "#fafafa",
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <select
                    value={att.statut}
                    onChange={e => updateStatut(att.id, e.target.value)}
                    style={{
                      flex: 1,
                      padding: "5px 8px",
                      borderRadius: 6,
                      border: "1px solid #e2e8f0",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    <option value="brouillon">Brouillon</option>
                    <option value="finalisee">Finalisée</option>
                    <option value="envoyee">Envoyée</option>
                    <option value="signee">Signée</option>
                  </select>
                  <button
                    onClick={() => generatePDF(att)}
                    style={{
                      padding: "5px 10px",
                      background: "#EFF6FF",
                      color: "#1D4ED8",
                      border: "1px solid #BFDBFE",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    📄 PDF
                  </button>
                  <button
                    onClick={() => del(att.id)}
                    style={{
                      padding: "5px 10px",
                      background: "#FEF2F2",
                      color: "#dc2626",
                      border: "1px solid #FECACA",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 11,
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* LIST VIEW */}
      {!loading && view === "list" && (
        <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #e2e8f0" }}>
                {["N° Marché", "Prestataire", "Dates", "Prestations", "Statut", "Actions"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "11px 12px", color: "#64748b", fontWeight: 500, fontSize: 12 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>
                    Aucune attestation
                  </td>
                </tr>
              ) : (
                filtered.map((att, i) => (
                  <tr key={att.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "white" : "#fafafa" }}>
                    <td style={{ padding: "11px 12px", fontWeight: 600, color: "#1e293b" }}>{att.numero_objet_marche}</td>
                    <td style={{ padding: "11px 12px", color: "#64748b" }}>{att.nom_prestataire}</td>
                    <td style={{ padding: "11px 12px", fontSize: 12, color: "#64748b" }}>
                      {att.date_debut && att.date_fin
                        ? `${new Date(att.date_debut).toLocaleDateString("fr-FR")} - ${new Date(att.date_fin).toLocaleDateString("fr-FR")}`
                        : "—"}
                    </td>
                    <td style={{ padding: "11px 12px", color: "#64748b" }}>{att.prestations?.length || 0}</td>
                    <td style={{ padding: "11px 12px" }}>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 8,
                          background: STATUT_COLORS[att.statut]?.bg,
                          color: STATUT_COLORS[att.statut]?.text,
                        }}
                      >
                        {STATUT_COLORS[att.statut]?.label}
                      </span>
                    </td>
                    <td style={{ padding: "11px 12px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={() => generatePDF(att)}
                          style={{
                            padding: "4px 8px",
                            background: "#EFF6FF",
                            color: "#1D4ED8",
                            border: "1px solid #BFDBFE",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 11,
                          }}
                        >
                          📄
                        </button>
                        <button
                          onClick={() => del(att.id)}
                          style={{
                            padding: "4px 8px",
                            background: "#FEF2F2",
                            color: "#dc2626",
                            border: "1px solid #FECACA",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 11,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Chargement...</div>
      )}
    </div>
  );
}
