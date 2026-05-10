import { useState, useEffect, useCallback } from "react";

const SUPABASE_URL = "https://vggmjxtqkxqeltrvwwpm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnZ21qeHRxa3hxZWx0cnZ3d3BtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNzUwOTIsImV4cCI6MjA5Mzk1MTA5Mn0.DS8LJk_4gJo8KASw14wq2Nc9_u8z4602XcaQ5PO0hmY";

const api = async (path, method = "GET", body = null) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  if (res.status === 204) return null;
  return res.json();
};

const STATUS_CONFIG = {
  novo: { label: "Novo", color: "#6366f1" },
  mensagem_enviada: { label: "Msg Enviada", color: "#f59e0b" },
  respondeu: { label: "Respondeu", color: "#3b82f6" },
  call_agendada: { label: "Call Agendada", color: "#8b5cf6" },
  call_realizada: { label: "Call Realizada", color: "#10b981" },
  fechado: { label: "Fechado ✓", color: "#059669" },
  perdido: { label: "Perdido", color: "#ef4444" },
  arquivado: { label: "Arquivado", color: "#9ca3af" },
};

const QUAL_CONFIG = {
  alta: { label: "Alta", color: "#10b981", bg: "#d1fae5" },
  media_alta: { label: "Média-Alta", color: "#3b82f6", bg: "#dbeafe" },
  media: { label: "Média", color: "#f59e0b", bg: "#fef3c7" },
  baixa: { label: "Baixa", color: "#ef4444", bg: "#fee2e2" },
};

const FUNIL = ["novo", "mensagem_enviada", "respondeu", "call_agendada", "call_realizada", "fechado"];

export default function CRM() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("kanban"); // kanban | lista
  const [filtroQual, setFiltroQual] = useState("todos");
  const [busca, setBusca] = useState("");
  const [historico, setHistorico] = useState([]);
  const [novaMsg, setNovaMsg] = useState("");
  const [tipoMsg, setTipoMsg] = useState("mensagem_whatsapp");
  const [modalNovo, setModalNovo] = useState(false);
  const [novoLead, setNovoLead] = useState({ nome: "", whatsapp: "", instagram: "", qualificacao: "media", status: "novo" });
  const [salvando, setSalvando] = useState(false);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api("leads?order=created_at.desc&select=*");
      setLeads(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const fetchHistorico = async (leadId) => {
    const data = await api(`historico_contatos?lead_id=eq.${leadId}&order=created_at.desc`);
    setHistorico(data || []);
  };

  const abrirLead = async (lead) => {
    setSelected(lead);
    await fetchHistorico(lead.id);
  };

  const atualizarCampo = async (leadId, campo, valor) => {
    await api(`leads?id=eq.${leadId}`, "PATCH", { [campo]: valor });
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, [campo]: valor } : l));
    if (selected?.id === leadId) setSelected(prev => ({ ...prev, [campo]: valor }));
  };

  const adicionarHistorico = async () => {
    if (!novaMsg.trim()) return;
    setSalvando(true);
    try {
      await api("historico_contatos", "POST", {
        lead_id: selected.id,
        tipo: tipoMsg,
        conteudo: novaMsg,
      });
      await fetchHistorico(selected.id);
      setNovaMsg("");
    } finally {
      setSalvando(false);
    }
  };

  const criarLead = async () => {
    if (!novoLead.nome.trim()) return;
    setSalvando(true);
    try {
      await api("leads", "POST", novoLead);
      await fetchLeads();
      setModalNovo(false);
      setNovoLead({ nome: "", whatsapp: "", instagram: "", qualificacao: "media", status: "novo" });
    } finally {
      setSalvando(false);
    }
  };

  const leadsFiltrados = leads.filter(l => {
    const matchQual = filtroQual === "todos" || l.qualificacao === filtroQual;
    const matchBusca = !busca || l.nome?.toLowerCase().includes(busca.toLowerCase()) || l.whatsapp?.includes(busca);
    return matchQual && matchBusca;
  });

  const leadsNaoArquivados = leadsFiltrados.filter(l => l.status !== "arquivado" && l.status !== "perdido");
  const leadsPorStatus = (status) => leadsNaoArquivados.filter(l => l.status === status);

  const stats = {
    total: leads.length,
    alta: leads.filter(l => l.qualificacao === "alta").length,
    calls: leads.filter(l => l.status === "call_agendada" || l.status === "call_realizada").length,
    fechados: leads.filter(l => l.status === "fechado").length,
  };

  const CardLead = ({ lead, compact = false }) => (
    <div
      onClick={() => abrirLead(lead)}
      style={{
        background: "#1a1a2e",
        border: "1px solid #2d2d4e",
        borderRadius: 10,
        padding: compact ? "10px 12px" : "14px",
        cursor: "pointer",
        marginBottom: 8,
        transition: "all 0.15s",
        borderLeft: `3px solid ${QUAL_CONFIG[lead.qualificacao]?.color || "#6366f1"}`,
      }}
      onMouseEnter={e => e.currentTarget.style.background = "#22223a"}
      onMouseLeave={e => e.currentTarget.style.background = "#1a1a2e"}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {lead.nome || "Sem nome"}
          </div>
          {!compact && (
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              {lead.profissao || "—"} {lead.pais && lead.pais !== "brasil" ? `· ${lead.pais}` : ""}
            </div>
          )}
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
          background: QUAL_CONFIG[lead.qualificacao]?.bg || "#e2e8f0",
          color: QUAL_CONFIG[lead.qualificacao]?.color || "#374151",
          whiteSpace: "nowrap", flexShrink: 0,
        }}>
          {QUAL_CONFIG[lead.qualificacao]?.label || "—"}
        </span>
      </div>
      {!compact && lead.objetivo && (
        <div style={{ fontSize: 11, color: "#7c87a6", marginTop: 6 }}>
          🎯 {lead.objetivo} · {lead.nivel?.replace("nivel_", "Nível ") || "—"}
        </div>
      )}
      {lead.whatsapp && (
        <div style={{ fontSize: 11, color: "#64748b", marginTop: compact ? 4 : 6 }}>📱 {lead.whatsapp}</div>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f1a", color: "#e2e8f0", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "#16162a", borderBottom: "1px solid #2d2d4e", padding: "0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🌍</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9" }}>FIT Global English</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>CRM de Leads</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setView("kanban")} style={{ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, background: view === "kanban" ? "#6366f1" : "#1e1e3a", color: view === "kanban" ? "#fff" : "#94a3b8" }}>Kanban</button>
            <button onClick={() => setView("lista")} style={{ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, background: view === "lista" ? "#6366f1" : "#1e1e3a", color: view === "lista" ? "#fff" : "#94a3b8" }}>Lista</button>
            <button onClick={() => setModalNovo(true)} style={{ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "#10b981", color: "#fff" }}>+ Novo Lead</button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, padding: "16px 24px 0" }}>
        {[
          { label: "Total de Leads", value: stats.total, icon: "👥", color: "#6366f1" },
          { label: "Qualidade Alta", value: stats.alta, icon: "🔥", color: "#10b981" },
          { label: "Calls", value: stats.calls, icon: "📞", color: "#8b5cf6" },
          { label: "Fechados", value: stats.fechados, icon: "✅", color: "#f59e0b" },
        ].map(s => (
          <div key={s.label} style={{ background: "#16162a", border: "1px solid #2d2d4e", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 20 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, padding: "12px 24px", alignItems: "center" }}>
        <input
          placeholder="Buscar por nome ou WhatsApp..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ flex: 1, maxWidth: 280, padding: "7px 12px", borderRadius: 8, border: "1px solid #2d2d4e", background: "#1a1a2e", color: "#e2e8f0", fontSize: 13, outline: "none" }}
        />
        {["todos", "alta", "media_alta", "media", "baixa"].map(q => (
          <button key={q} onClick={() => setFiltroQual(q)} style={{
            padding: "6px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500,
            background: filtroQual === q ? (QUAL_CONFIG[q]?.color || "#6366f1") : "#1e1e3a",
            color: filtroQual === q ? "#fff" : "#94a3b8",
          }}>
            {q === "todos" ? "Todos" : QUAL_CONFIG[q]?.label}
          </button>
        ))}
        <button onClick={fetchLeads} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #2d2d4e", background: "transparent", color: "#64748b", cursor: "pointer", fontSize: 13 }}>↻</button>
      </div>

      {loading && <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>Carregando leads...</div>}
      {error && <div style={{ textAlign: "center", padding: 20, color: "#ef4444", fontSize: 13 }}>Erro: {error}</div>}

      {/* Kanban */}
      {!loading && view === "kanban" && (
        <div style={{ display: "flex", gap: 12, padding: "0 24px 24px", overflowX: "auto" }}>
          {FUNIL.map(status => {
            const col = leadsPorStatus(status);
            return (
              <div key={status} style={{ minWidth: 220, maxWidth: 220, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 2px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_CONFIG[status]?.color }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{STATUS_CONFIG[status]?.label}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "#475569", background: "#1e1e3a", padding: "1px 7px", borderRadius: 10 }}>{col.length}</span>
                </div>
                <div style={{ minHeight: 80 }}>
                  {col.map(lead => <CardLead key={lead.id} lead={lead} />)}
                  {col.length === 0 && <div style={{ fontSize: 12, color: "#374151", textAlign: "center", padding: "20px 0" }}>Vazio</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lista */}
      {!loading && view === "lista" && (
        <div style={{ padding: "0 24px 24px" }}>
          <div style={{ background: "#16162a", border: "1px solid #2d2d4e", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.2fr 1fr", padding: "10px 16px", borderBottom: "1px solid #2d2d4e", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <span>Nome</span><span>Profissão</span><span>Qualificação</span><span>Status</span><span>WhatsApp</span>
            </div>
            {leadsFiltrados.map(lead => (
              <div key={lead.id} onClick={() => abrirLead(lead)} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.2fr 1fr", padding: "12px 16px", borderBottom: "1px solid #1e1e3a", cursor: "pointer", alignItems: "center", transition: "background 0.1s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#1a1a2e"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{lead.nome}</span>
                <span style={{ fontSize: 13, color: "#94a3b8" }}>{lead.profissao || "—"}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: QUAL_CONFIG[lead.qualificacao]?.bg, color: QUAL_CONFIG[lead.qualificacao]?.color, display: "inline-block" }}>
                  {QUAL_CONFIG[lead.qualificacao]?.label || "—"}
                </span>
                <span style={{ fontSize: 11, color: STATUS_CONFIG[lead.status]?.color }}>{STATUS_CONFIG[lead.status]?.label}</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>{lead.whatsapp || "—"}</span>
              </div>
            ))}
            {leadsFiltrados.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#374151", fontSize: 13 }}>Nenhum lead encontrado</div>}
          </div>
        </div>
      )}

      {/* Modal detalhe do lead */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", justifyContent: "flex-end" }} onClick={() => setSelected(null)}>
          <div style={{ width: 480, background: "#16162a", height: "100%", overflowY: "auto", borderLeft: "1px solid #2d2d4e", padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>{selected.nome}</h2>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{selected.profissao || "Profissão não informada"}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "#64748b", fontSize: 20, cursor: "pointer", padding: 4 }}>✕</button>
            </div>

            {/* Qualificação */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Qualificação</label>
              <div style={{ display: "flex", gap: 6 }}>
                {Object.entries(QUAL_CONFIG).map(([k, v]) => (
                  <button key={k} onClick={() => atualizarCampo(selected.id, "qualificacao", k)} style={{
                    padding: "5px 12px", borderRadius: 20, border: "2px solid", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.15s",
                    borderColor: selected.qualificacao === k ? v.color : "transparent",
                    background: selected.qualificacao === k ? v.bg : "#1e1e3a",
                    color: selected.qualificacao === k ? v.color : "#64748b",
                  }}>{v.label}</button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Status no Funil</label>
              <select value={selected.status} onChange={e => atualizarCampo(selected.id, "status", e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #2d2d4e", background: "#1a1a2e", color: "#e2e8f0", fontSize: 13, outline: "none" }}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            {/* Dados do formulário */}
            <div style={{ background: "#1a1a2e", borderRadius: 10, padding: 16, marginBottom: 20, border: "1px solid #2d2d4e" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6366f1", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Dados do Formulário</div>
              {[
                ["📱 WhatsApp", selected.whatsapp],
                ["📸 Instagram", selected.instagram],
                ["🎯 Objetivo", selected.objetivo],
                ["📊 Nível", selected.nivel?.replace("nivel_", "Nível ")],
                ["🌍 País", selected.pais],
                ["💬 Bloqueio", selected.bloqueio],
                ["❓ Por que aprender", selected.motivo_aprender],
                ["✨ O que mudaria", selected.o_que_mudaria],
                ["🕐 Horários", selected.horarios_disponiveis?.join(", ")],
                ["📅 Dias", selected.dias_disponiveis?.join(", ")],
                ["💰 Disposto a investir", selected.disposto_investir],
                ["ℹ️ Info adicional", selected.info_adicional],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: "#64748b" }}>{label}: </span>
                  <span style={{ fontSize: 13, color: "#cbd5e1" }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Observações */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Observações</label>
              <textarea
                defaultValue={selected.observacoes_qualificacao || ""}
                onBlur={e => atualizarCampo(selected.id, "observacoes_qualificacao", e.target.value)}
                placeholder="Anotações sobre esse lead..."
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #2d2d4e", background: "#1a1a2e", color: "#e2e8f0", fontSize: 13, resize: "vertical", minHeight: 80, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* Histórico */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Histórico de Contato</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <select value={tipoMsg} onChange={e => setTipoMsg(e.target.value)} style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #2d2d4e", background: "#1a1a2e", color: "#94a3b8", fontSize: 12, outline: "none" }}>
                  <option value="mensagem_whatsapp">WhatsApp</option>
                  <option value="resposta_lead">Resposta do lead</option>
                  <option value="call">Call</option>
                  <option value="anotacao">Anotação</option>
                </select>
                <input value={novaMsg} onChange={e => setNovaMsg(e.target.value)} placeholder="Registrar contato..." onKeyDown={e => e.key === "Enter" && adicionarHistorico()} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid #2d2d4e", background: "#1a1a2e", color: "#e2e8f0", fontSize: 13, outline: "none" }} />
                <button onClick={adicionarHistorico} disabled={salvando} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+</button>
              </div>
              <div style={{ maxHeight: 240, overflowY: "auto" }}>
                {historico.map(h => (
                  <div key={h.id} style={{ padding: "10px 12px", background: "#1a1a2e", borderRadius: 8, marginBottom: 6, border: "1px solid #2d2d4e" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "#6366f1", fontWeight: 600 }}>{h.tipo?.replace("_", " ")}</span>
                      <span style={{ fontSize: 11, color: "#475569" }}>{new Date(h.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#cbd5e1" }}>{h.conteudo}</div>
                  </div>
                ))}
                {historico.length === 0 && <div style={{ fontSize: 12, color: "#374151", textAlign: "center", padding: 16 }}>Nenhum contato registrado</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo lead */}
      {modalNovo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setModalNovo(false)}>
          <div style={{ background: "#16162a", borderRadius: 14, padding: 28, width: 400, border: "1px solid #2d2d4e" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>Novo Lead Manual</h3>
            {[["Nome completo", "nome", "text"], ["WhatsApp", "whatsapp", "text"], ["Instagram", "instagram", "text"]].map(([label, field, type]) => (
              <div key={field} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>{label}</label>
                <input type={type} value={novoLead[field]} onChange={e => setNovoLead(p => ({ ...p, [field]: e.target.value }))} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #2d2d4e", background: "#1a1a2e", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Qualificação inicial</label>
              <select value={novoLead.qualificacao} onChange={e => setNovoLead(p => ({ ...p, qualificacao: e.target.value }))} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #2d2d4e", background: "#1a1a2e", color: "#e2e8f0", fontSize: 13, outline: "none" }}>
                {Object.entries(QUAL_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setModalNovo(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #2d2d4e", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
              <button onClick={criarLead} disabled={salvando || !novoLead.nome.trim()} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Criar Lead</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
