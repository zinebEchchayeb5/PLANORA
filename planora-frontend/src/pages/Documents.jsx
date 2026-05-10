import { useState, useEffect } from "react";

const API = "http://127.0.0.1:8000";

export default function Documents({ user }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("all");

  // Formulaire d'upload
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState("");
  const [categorie, setCategorie] = useState("plan");
  const [commentaire, setCommentaire] = useState("Version initiale");

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/documents`);
      const data = await res.json();
      setDocuments(data);
    } catch (e) {
      console.error("Erreur lors de la récupération des documents", e);
    }
    setLoading(false);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files;
    if (selectedFile) {
      setFile(selectedFile);
      // Prédétection intelligente de la catégorie selon l'extension
      const ext = selectedFile.name.split(".").pop().toLowerCase();
      if (ext === "dwg" || ext === "dxf") {
        setCategorie("plan");
      } else if (ext === "pdf") {
        setCategorie("contrat");
      } else if (["png", "jpg", "jpeg", "webp"].includes(ext)) {
        setCategorie("image");
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("description", description);
    formData.append("categorie", categorie);
    formData.append("cree_par", user?.nom || "Architecte");
    formData.append("commentaire", commentaire);

    try {
      const res = await fetch(`${API}/documents/upload`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        // Reset form
        setFile(null);
        setDescription("");
        setCommentaire("Version initiale");
        fetchDocuments();
        alert("Fichier importé avec succès !");
      } else {
        alert("Erreur lors de l'importation");
      }
    } catch (e) {
      console.error(e);
    }
    setUploading(false);
  };

  const downloadFile = (docId, versionNum = null) => {
    let url = `${API}/documents/download/${docId}`;
    if (versionNum) url += `?version=${versionNum}`;
    window.open(url, "_blank");
  };

  const fetchHistory = async (doc) => {
    setSelectedDoc(doc);
    try {
      const res = await fetch(`${API}/documents/${doc.id}/history`);
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteDocument = async (id) => {
    if (!confirm("Voulez-vous vraiment supprimer ce document et toutes ses versions historiques ?")) return;
    try {
      await fetch(`${API}/documents/${id}`, { method: "DELETE" });
      fetchDocuments();
      if (selectedDoc?.id === id) setSelectedDoc(null);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredDocs = documents.filter((doc) => {
    if (activeTab === "all") return true;
    return doc.categorie === activeTab;
  });

  const getFormatIcon = (format) => {
    const f = format.replace(".", "").toLowerCase();
    if (f === "dwg" || f === "dxf") return "📐";
    if (f === "pdf") return "📄";
    if (["png", "jpg", "jpeg"].includes(f)) return "🖼️";
    if (["xlsx", "xls", "csv"].includes(f)) return "📊";
    return "📁";
  };

  return (
    <div style={{ display: "flex", gap: 24, padding: 20, minHeight: "85vh", background: "#f8fafc", fontFamily: "system-ui" }}>
      {/* Colonne de Gauche : Liste & Import */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
        
        {/* Titre & Statistiques */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e293b", margin: 0 }}>Gestionnaire de Documents & Plans</h1>
            <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0 0" }}>Espace collaboratif et historique de versions (AutoCAD, Contrats, Devis, PDF)</p>
          </div>
        </div>

        {/* Formulaire d'import rapide */}
        <div style={{ background: "white", borderRadius: 12, padding: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: 14, color: "#334155" }}>Importer un nouveau fichier / Nouvelle version</h3>
          <form onSubmit={handleUpload} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Fichier (DWG, PDF, JPG, etc.)</label>
              <input type="file" onChange={handleFileChange} required style={{ fontSize: 12, padding: "6px", background: "#f1f5f9", borderRadius: 6, border: "1px solid #cbd5e1" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Catégorie</label>
              <select value={categorie} onChange={(e) => setCategorie(e.target.value)} style={{ fontSize: 12, padding: "8px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
                <option value="plan">📐 Plan Architectural (DWG / Image)</option>
                <option value="contrat">📜 Contrat de construction</option>
                <option value="devis">💵 Devis & Factures</option>
                <option value="autre">📁 Autre Document</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Note de version / Commentaire</label>
              <input type="text" value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Ex: Version corrigée après retours" style={{ fontSize: 12, padding: "8px", borderRadius: 6, border: "1px solid #cbd5e1" }} />
            </div>

            <div style={{ gridColumn: "span 3", display: "flex", gap: 12, marginTop: 8 }}>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description rapide du fichier..." style={{ flex: 1, fontSize: 12, padding: "8px", borderRadius: 6, border: "1px solid #cbd5e1" }} />
              <button type="submit" disabled={uploading} style={{ background: "#4f46e5", color: "white", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {uploading ? "Importation..." : "📤 Téléverser"}
              </button>
            </div>
          </form>
        </div>

        {/* Filtres de catégories */}
        <div style={{ display: "flex", gap: 8, background: "#e2e8f0", padding: 4, borderRadius: 8, width: "fit-content" }}>
          {[
            { id: "all", label: "Tout afficher" },
            { id: "plan", label: "📐 Plans AutoCAD" },
            { id: "contrat", label: "📜 Contrats" },
            { id: "devis", label: "💵 Devis / Estimation" },
            { id: "autre", label: "📁 Autres" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                border: "none",
                background: activeTab === tab.id ? "white" : "transparent",
                color: activeTab === tab.id ? "#1e293b" : "#64748b",
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                cursor: "pointer",
                boxShadow: activeTab === tab.id ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                transition: "all 0.2s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table/Grille des Documents */}
        <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Chargement des fichiers...</div>
          ) : filteredDocs.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Aucun fichier trouvé dans cette catégorie.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontWeight: 600 }}>
                  <th style={{ padding: "12px 16px" }}>Nom du fichier</th>
                  <th style={{ padding: "12px 16px" }}>Catégorie</th>
                  <th style={{ padding: "12px 16px" }}>Version</th>
                  <th style={{ padding: "12px 16px" }}>Taille</th>
                  <th style={{ padding: "12px 16px" }}>Importé par</th>
                  <th style={{ padding: "12px 16px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: "1px solid #f1f5f9", hover: { background: "#f8fafc" } }}>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{getFormatIcon(doc.format_fichier)}</span>
                        <div>
                          <div style={{ fontWeight: 600, color: "#1e293b" }}>{doc.nom}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{doc.description || "Aucune description"}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ background: "#f1f5f9", padding: "4px 8px", borderRadius: 12, fontSize: 11, color: "#475569", textTransform: "capitalize" }}>{doc.categorie}</span>
                    </td>
                    <td style={{ padding: "14px 16px", fontWeight: "bold", color: "#4f46e5" }}>v{doc.version_actuelle}</td>
                    <td style={{ padding: "14px 16px", color: "#64748b" }}>{doc.taille} Mo</td>
                    <td style={{ padding: "14px 16px" }}>
                      <div>{doc.cree_par}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>{new Date(doc.date_creation).toLocaleDateString()}</div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => downloadFile(doc.id)} style={{ padding: "6px 10px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12, cursor: "pointer" }} title="Télécharger la dernière version">
                          📥 Télécharger
                        </button>
                        <button onClick={() => fetchHistory(doc)} style={{ padding: "6px 10px", background: "#e0e7ff", color: "#4338ca", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600 }} title="Voir l'historique des modifications">
                          🕒 Versions ({doc.version_actuelle})
                        </button>
                        <button onClick={() => deleteDocument(doc.id)} style={{ padding: "6px 10px", background: "#fee2e2", color: "#b91c1c", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }} title="Supprimer définitivement">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Volet Latéral Droit : Historique de Versioning */}
      {selectedDoc && (
        <div style={{ width: 350, background: "white", borderRadius: 12, border: "1px solid #e2e8f0", padding: 20, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: "#1e293b" }}>Historique des Versions</h3>
            <button onClick={() => setSelectedDoc(null)} style={{ border: "none", background: "none", fontSize: 16, cursor: "pointer", color: "#94a3b8" }}>✕</button>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Fichier actif</div>
            <h4 style={{ margin: "4px 0", color: "#1e293b" }}>{selectedDoc.nom}</h4>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Version actuelle : <b style={{ color: "#4f46e5" }}>v{selectedDoc.version_actuelle}</b></p>
          </div>

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Toutes les modifications</div>
            
            {history.map((v) => (
              <div key={v.id} style={{ borderLeft: "2px solid #4f46e5", paddingLeft: 12, position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: "#4f46e5" }}>Version v{v.version_numero}</span>
                  <button onClick={() => downloadFile(selectedDoc.id, v.version_numero)} style={{ background: "none", border: "none", color: "#4f46e5", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>
                    Télécharger
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "#334155", marginTop: 4, fontStyle: "italic" }}>"{v.commentaire || "Aucune note"}"</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
                  Modifié par <b>{v.modifie_par}</b> le {new Date(v.date_modification).toLocaleDateString()} à {new Date(v.date_modification).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}