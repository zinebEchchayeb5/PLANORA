import { useState, useEffect, useRef } from "react";

const API = "http://127.0.0.1:8000";

const CATEGORIES = [
  { id:"plan",    label:"Plans",     icon:"📐", color:"#3B82F6" },
  { id:"contrat", label:"Contrats",  icon:"📋", color:"#8B5CF6" },
  { id:"devis",   label:"Devis",     icon:"💰", color:"#10B981" },
  { id:"photo",   label:"Photos",    icon:"🖼️", color:"#F59E0B" },
  { id:"autre",   label:"Autres",    icon:"📁", color:"#64748b" },
];

const TYPE_ICONS = {pdf:"📄",image:"🖼️",dwg:"📐",dxf:"📐",docx:"📝",doc:"📝",xlsx:"📊",autre:"📁"};
const TYPE_COLORS = {pdf:"#EF4444",image:"#F59E0B",dwg:"#3B82F6",dxf:"#3B82F6",docx:"#8B5CF6",doc:"#8B5CF6",xlsx:"#10B981",autre:"#64748b"};

export default function Fichiers() {
  const [fichiers, setFichiers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null); // fichier detail
  const [versions, setVersions] = useState([]);
  const [comments, setComments] = useState([]);
  const [historique, setHistorique] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [detailTab, setDetailTab] = useState("info");
  const fileRef = useRef();
  const versionRef = useRef();

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [f, s] = await Promise.all([
        fetch(`${API}/fichiers/`).then(r => r.json()),
        fetch(`${API}/fichiers/stats/overview`).then(r => r.json()),
      ]);
      setFichiers(Array.isArray(f) ? f : []);
      setStats(s);
    } catch {}
    setLoading(false);
  };

  const openDetail = async (f) => {
    setSelected(f); setDetailTab("info");
    const [v, c, h] = await Promise.all([
      fetch(`${API}/fichiers/${f.id}/versions`).then(r => r.json()),
      fetch(`${API}/fichiers/${f.id}/commentaires`).then(r => r.json()),
      fetch(`${API}/fichiers/${f.id}/historique`).then(r => r.json()),
    ]);
    setVersions(Array.isArray(v)?v:[]);
    setComments(Array.isArray(c)?c:[]);
    setHistorique(Array.isArray(h)?h:[]);
  };

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("categorie", filterCat === "all" ? "autre" : filterCat);
      fd.append("uploaded_by", "Utilisateur");
      try {
        await fetch(`${API}/fichiers/upload`, { method:"POST", body: fd });
      } catch {}
    }
    setUploading(false);
    e.target.value = "";
    fetchAll();
  };

  const handleNewVersion = async (e) => {
    if (!selected || !e.target.files[0]) return;
    const fd = new FormData();
    fd.append("file", e.target.files[0]);
    fd.append("uploaded_by", "Utilisateur");
    await fetch(`${API}/fichiers/nouvelle-version/${selected.id}`, { method:"POST", body:fd });
    e.target.value = "";
    openDetail(selected); fetchAll();
  };

  const addComment = async () => {
    if (!newComment.trim() || !selected) return;
    await fetch(`${API}/fichiers/${selected.id}/commentaires`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ texte: newComment, auteur: "Utilisateur" })
    });
    setNewComment("");
    const c = await fetch(`${API}/fichiers/${selected.id}/commentaires`).then(r=>r.json());
    setComments(c);
  };

  const download = (f) => window.open(`${API}/fichiers/${f.id}/download`);

  const deleteFichier = async (id) => {
    if (!confirm("Supprimer ce fichier?")) return;
    await fetch(`${API}/fichiers/${id}`, { method:"DELETE" });
    if (selected?.id === id) setSelected(null);
    fetchAll();
  };

  const filtered = fichiers
    .filter(f => filterCat==="all" || f.categorie===filterCat)
    .filter(f => !search || f.nom.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ display:"flex", gap:0, height:"calc(100vh - 80px)", overflow:"hidden" }}>
      {/* LEFT — File list */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
          <div>
            <h1 style={{ margin:0, fontSize:20, color:"#1e293b" }}>Gestion des fichiers</h1>
            {stats && <p style={{ margin:"3px 0 0", color:"#64748b", fontSize:13 }}>
              {stats.total_fichiers} fichiers · {stats.taille_totale}
            </p>}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input ref={fileRef} type="file" multiple style={{ display:"none" }}
              accept=".pdf,.jpg,.jpeg,.png,.dwg,.dxf,.docx,.doc,.xlsx,.zip"
              onChange={handleUpload}/>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              style={{ padding:"8px 18px", background:uploading?"#94a3b8":"#1e293b", color:"white",
                border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600 }}>
              {uploading ? "⏳ Upload..." : "📤 Uploader fichier"}
            </button>
          </div>
        </div>

        {/* Stats cards */}
        {stats?.par_type && (
          <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
            {stats.par_type.map(t => (
              <div key={t.type} style={{ background:"white", borderRadius:8, padding:"8px 14px",
                border:"1px solid #e2e8f0", display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:18, color:TYPE_COLORS[t.type]||"#64748b" }}>{TYPE_ICONS[t.type]||"📁"}</span>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"#1e293b" }}>{t.count}</div>
                  <div style={{ fontSize:11, color:"#64748b", textTransform:"uppercase" }}>{t.type}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center", flexWrap:"wrap" }}>
          <button onClick={() => setFilterCat("all")}
            style={{ padding:"5px 14px", borderRadius:20, border:"1px solid #e2e8f0", fontSize:12, cursor:"pointer",
              background:filterCat==="all"?"#1e293b":"white", color:filterCat==="all"?"white":"#64748b" }}>
            Tous
          </button>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setFilterCat(c.id)}
              style={{ padding:"5px 14px", borderRadius:20, border:`1px solid ${c.color}44`, fontSize:12, cursor:"pointer",
                background:filterCat===c.id?c.color:"white", color:filterCat===c.id?"white":c.color, fontWeight:500 }}>
              {c.icon} {c.label}
            </button>
          ))}
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="🔍 Rechercher..."
            style={{ padding:"6px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:12,
              outline:"none", marginLeft:"auto", width:200 }}/>
        </div>

        {/* Drag & Drop zone */}
        <div
          onDragOver={e=>{e.preventDefault();e.currentTarget.style.background="#eff6ff";}}
          onDragLeave={e=>{e.currentTarget.style.background="transparent";}}
          onDrop={async e=>{
            e.preventDefault(); e.currentTarget.style.background="transparent";
            const dt = new DataTransfer();
            for (const f of e.dataTransfer.files) dt.items.add(f);
            const inp = fileRef.current;
            if (inp) { Object.defineProperty(inp,'files',{value:dt.files,configurable:true}); handleUpload({target:inp}); }
          }}
          style={{ border:"2px dashed #cbd5e1", borderRadius:10, padding:"12px 20px",
            marginBottom:14, textAlign:"center", color:"#94a3b8", fontSize:12,
            transition:"background .2s", cursor:"pointer" }}
          onClick={() => fileRef.current?.click()}>
          📂 Glissez-déposez vos fichiers ici ou cliquez pour uploader
        </div>

        {/* File grid */}
        {loading ? (
          <div style={{ textAlign:"center", padding:40, color:"#94a3b8" }}>⏳ Chargement...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:40, color:"#94a3b8" }}>
            <div style={{ fontSize:40, marginBottom:8 }}>📁</div>
            <p>Aucun fichier — uploadez votre premier fichier</p>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:12, overflowY:"auto" }}>
            {filtered.map(f => {
              const isSelected = selected?.id === f.id;
              const typeColor = TYPE_COLORS[f.type] || "#64748b";
              return (
                <div key={f.id}
                  onClick={() => openDetail(f)}
                  style={{ background:"white", borderRadius:10, padding:14,
                    border:`2px solid ${isSelected?"#3B82F6":"#e2e8f0"}`,
                    cursor:"pointer", transition:"all .15s",
                    boxShadow: isSelected ? "0 4px 12px rgba(59,130,246,.2)":"0 1px 3px rgba(0,0,0,.04)" }}>
                  {/* Icon */}
                  <div style={{ fontSize:36, marginBottom:10, textAlign:"center" }}>
                    {TYPE_ICONS[f.type]||"📁"}
                  </div>
                  {/* Name */}
                  <div style={{ fontSize:11, fontWeight:500, color:"#1e293b", marginBottom:4,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {f.nom}
                  </div>
                  {/* Meta */}
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontSize:10, padding:"1px 6px", borderRadius:10,
                      background:typeColor+"22", color:typeColor, fontWeight:500 }}>
                      {f.type.toUpperCase()}
                    </span>
                    <span style={{ fontSize:10, color:"#94a3b8" }}>{f.taille_formatted}</span>
                  </div>
                  {/* Version badge */}
                  {f.nb_versions > 1 && (
                    <div style={{ fontSize:10, color:"#3B82F6", marginBottom:4 }}>
                      📌 {f.nb_versions} versions
                    </div>
                  )}
                  {/* Comments */}
                  {f.nb_commentaires > 0 && (
                    <div style={{ fontSize:10, color:"#64748b" }}>
                      💬 {f.nb_commentaires} commentaire(s)
                    </div>
                  )}
                  {/* Actions */}
                  <div style={{ display:"flex", gap:4, marginTop:8 }}>
                    <button onClick={e=>{e.stopPropagation();download(f);}}
                      style={{ flex:1, padding:"4px 0", background:"#eff6ff", color:"#1d4ed8",
                        border:"none", borderRadius:5, cursor:"pointer", fontSize:10 }}>
                      ⬇️
                    </button>
                    <button onClick={e=>{e.stopPropagation();deleteFichier(f.id);}}
                      style={{ flex:1, padding:"4px 0", background:"#fef2f2", color:"#dc2626",
                        border:"none", borderRadius:5, cursor:"pointer", fontSize:10 }}>
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT — Detail panel */}
      {selected && (
        <div style={{ width:340, flexShrink:0, borderLeft:"1px solid #e2e8f0",
          marginLeft:16, paddingLeft:16, overflowY:"auto", display:"flex", flexDirection:"column" }}>

          {/* Header */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:28, marginBottom:4 }}>{TYPE_ICONS[selected.type]||"📁"}</div>
              <div style={{ fontWeight:600, fontSize:14, color:"#1e293b", wordBreak:"break-all" }}>
                {selected.nom}
              </div>
              <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>
                {selected.taille_formatted} · v{selected.version} · {selected.created_at}
              </div>
            </div>
            <button onClick={()=>setSelected(null)}
              style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:"#94a3b8" }}>✕</button>
          </div>

          {/* Actions */}
          <div style={{ display:"flex", gap:6, marginBottom:14 }}>
            <button onClick={()=>download(selected)}
              style={{ flex:1, padding:"7px 0", background:"#1e293b", color:"white", border:"none", borderRadius:7, cursor:"pointer", fontSize:12, fontWeight:500 }}>
              ⬇️ Télécharger
            </button>
            <input ref={versionRef} type="file" style={{ display:"none" }} onChange={handleNewVersion}/>
            <button onClick={()=>versionRef.current?.click()}
              style={{ flex:1, padding:"7px 0", background:"#eff6ff", color:"#1d4ed8", border:"1px solid #bfdbfe", borderRadius:7, cursor:"pointer", fontSize:12, fontWeight:500 }}>
              🔄 Nouvelle v.
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display:"flex", gap:2, marginBottom:14, background:"#f1f5f9", borderRadius:8, padding:3 }}>
            {[["info","ℹ️ Info"],["versions","📌 Versions"],["comments","💬 Commentaires"],["historique","🕐 Historique"]].map(([id,label])=>(
              <button key={id} onClick={()=>setDetailTab(id)}
                style={{ flex:1, padding:"5px 0", borderRadius:6, border:"none", cursor:"pointer", fontSize:10,
                  background:detailTab===id?"white":"transparent",
                  color:detailTab===id?"#1e293b":"#94a3b8",
                  fontWeight:detailTab===id?600:400 }}>
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {detailTab==="info" && (
            <div>
              {[
                ["Type",selected.type?.toUpperCase()],
                ["Catégorie",selected.categorie],
                ["Taille",selected.taille_formatted],
                ["Version",`v${selected.version}`],
                ["Uploadé par",selected.uploaded_by],
                ["Date",selected.created_at],
                ["Commentaires",selected.nb_commentaires],
              ].map(([k,v])=>(
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid #f1f5f9" }}>
                  <span style={{ fontSize:12, color:"#64748b" }}>{k}</span>
                  <span style={{ fontSize:12, color:"#1e293b", fontWeight:500 }}>{v||"—"}</span>
                </div>
              ))}
              {selected.description && (
                <div style={{ marginTop:10, padding:10, background:"#f8fafc", borderRadius:7, fontSize:12, color:"#374151" }}>
                  {selected.description}
                </div>
              )}
            </div>
          )}

          {detailTab==="versions" && (
            <div>
              {versions.length === 0 ? (
                <div style={{ textAlign:"center", color:"#94a3b8", padding:20, fontSize:12 }}>
                  Aucune version précédente
                </div>
              ) : versions.map(v => (
                <div key={v.id} style={{ padding:"10px 12px", background:"white", border:"1px solid #e2e8f0",
                  borderRadius:8, marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontWeight:600, fontSize:12, color:"#3B82F6" }}>v{v.version}</span>
                    <span style={{ fontSize:10, color:"#94a3b8" }}>{v.taille}</span>
                  </div>
                  <div style={{ fontSize:11, color:"#64748b", marginTop:3 }}>{v.uploaded_by} · {v.created_at}</div>
                  {v.description && <div style={{ fontSize:11, color:"#94a3b8", marginTop:3 }}>{v.description}</div>}
                </div>
              ))}
            </div>
          )}

          {detailTab==="comments" && (
            <div>
              {/* Add comment */}
              <div style={{ display:"flex", gap:6, marginBottom:12 }}>
                <input value={newComment} onChange={e=>setNewComment(e.target.value)}
                  placeholder="Ajouter un commentaire..."
                  onKeyDown={e=>e.key==="Enter"&&addComment()}
                  style={{ flex:1, padding:"7px 10px", borderRadius:7, border:"1px solid #e2e8f0",
                    fontSize:12, outline:"none" }}/>
                <button onClick={addComment}
                  style={{ padding:"7px 12px", background:"#1e293b", color:"white", border:"none",
                    borderRadius:7, cursor:"pointer", fontSize:12 }}>
                  ➤
                </button>
              </div>
              {comments.length === 0 ? (
                <div style={{ textAlign:"center", color:"#94a3b8", fontSize:12, padding:16 }}>Aucun commentaire</div>
              ) : comments.map(c => (
                <div key={c.id} style={{ padding:"9px 11px", background:"#f8fafc",
                  borderRadius:8, marginBottom:8, border:"1px solid #f1f5f9" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:"#1e293b" }}>{c.auteur}</span>
                    <span style={{ fontSize:10, color:"#94a3b8" }}>{c.date}</span>
                  </div>
                  <div style={{ fontSize:12, color:"#374151", lineHeight:1.5 }}>{c.texte}</div>
                </div>
              ))}
            </div>
          )}

          {detailTab==="historique" && (
            <div>
              {historique.length === 0 ? (
                <div style={{ textAlign:"center", color:"#94a3b8", fontSize:12, padding:16 }}>Aucun historique</div>
              ) : historique.map(h => {
                const actionIcons = {upload:"📤",telechargement:"⬇️",commentaire:"💬",nouvelle_version:"🔄",default:"📝"};
                return (
                  <div key={h.id} style={{ display:"flex", gap:8, padding:"8px 0", borderBottom:"1px solid #f1f5f9" }}>
                    <span style={{ fontSize:16 }}>{actionIcons[h.action]||actionIcons.default}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, fontWeight:500, color:"#1e293b" }}>{h.action}</div>
                      <div style={{ fontSize:10, color:"#64748b" }}>{h.auteur} · {h.date}</div>
                      {h.detail && <div style={{ fontSize:10, color:"#94a3b8", marginTop:2 }}>{h.detail}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}