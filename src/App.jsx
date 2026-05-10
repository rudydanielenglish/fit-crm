import { useState, useEffect, useCallback } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const api = async (path, method = "GET", body = null) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: method === "POST" ? "return=representation" : "return=minimal" },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
};

const STATUS = {
  novo: { label: "Novo", dot: "#3B5BDB" },
  mensagem_enviada: { label: "Msg Enviada", dot: "#D97706" },
  respondeu: { label: "Respondeu", dot: "#0284C7" },
  call_agendada: { label: "Call Agendada", dot: "#7C3AED" },
  call_realizada: { label: "Call Realizada", dot: "#0D9488" },
  fechado: { label: "Fechado", dot: "#16A34A" },
  perdido: { label: "Perdido", dot: "#DC2626" },
  arquivado: { label: "Arquivado", dot: "#94A3B8" },
};

const QUAL = {
  alta: { label: "Alta", color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
  media_alta: { label: "Média-Alta", color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
  media: { label: "Média", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  baixa: { label: "Baixa", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
};

const FUNIL = ["novo","mensagem_enviada","respondeu","call_agendada","call_realizada","fechado"];

const G = `@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Geist:wght@400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#F8F9FB;color:#0F172A;font-family:'Geist',sans-serif}
::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:#D1D9E0;border-radius:2px}
input,textarea,select{font-family:'Geist',sans-serif;background:#fff;border:1px solid #E8ECF0;color:#0F172A;border-radius:8px;outline:none;transition:border-color .2s}
input:focus,textarea:focus,select:focus{border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,.08)}
button{font-family:'Geist',sans-serif;cursor:pointer;border:none;transition:all .15s}
@keyframes fi{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
@keyframes si{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
.c{animation:fi .2s ease}.p{animation:si .18s ease}`;

export default function CRM() {
  const [leads,setLeads]=useState([]);
  const [loading,setLoading]=useState(true);
  const [sel,setSel]=useState(null);
  const [view,setView]=useState("kanban");
  const [fq,setFq]=useState("todos");
  const [busca,setBusca]=useState("");
  const [hist,setHist]=useState([]);
  const [msg,setMsg]=useState("");
  const [tipo,setTipo]=useState("mensagem_whatsapp");
  const [mnovo,setMnovo]=useState(false);
  const [nlead,setNlead]=useState({nome:"",whatsapp:"",instagram:"",qualificacao:"media",status:"novo"});
  const [salv,setSalv]=useState(false);
  const [err,setErr]=useState(null);

  const fetchLeads=useCallback(async()=>{
    try{setLoading(true);setErr(null);const d=await api("leads?order=created_at.desc&select=*");setLeads(d||[]);}
    catch(e){setErr(e.message);}finally{setLoading(false);}
  },[]);

  useEffect(()=>{fetchLeads();},[fetchLeads]);

  const fetchHist=async(id)=>{const d=await api(`historico_contatos?lead_id=eq.${id}&order=created_at.desc`);setHist(d||[]);};
  const abrir=async(l)=>{setSel(l);await fetchHist(l.id);};
  const upd=async(id,k,v)=>{
    await api(`leads?id=eq.${id}`,"PATCH",{[k]:v});
    setLeads(p=>p.map(l=>l.id===id?{...l,[k]:v}:l));
    if(sel?.id===id)setSel(p=>({...p,[k]:v}));
  };
  const addHist=async()=>{
    if(!msg.trim()||salv)return;setSalv(true);
    try{await api("historico_contatos","POST",{lead_id:sel.id,tipo,conteudo:msg});await fetchHist(sel.id);setMsg("");}
    finally{setSalv(false);}
  };
  const criar=async()=>{
    if(!nlead.nome.trim()||salv)return;setSalv(true);
    try{await api("leads","POST",nlead);await fetchLeads();setMnovo(false);setNlead({nome:"",whatsapp:"",instagram:"",qualificacao:"media",status:"novo"});}
    finally{setSalv(false);}
  };

  const lf=leads.filter(l=>(fq==="todos"||l.qualificacao===fq)&&(!busca||l.nome?.toLowerCase().includes(busca.toLowerCase())||l.whatsapp?.includes(busca)));
  const la=lf.filter(l=>l.status!=="arquivado"&&l.status!=="perdido");
  const ps=s=>la.filter(l=>l.status===s);
  const st={total:leads.length,alta:leads.filter(l=>l.qualificacao==="alta").length,calls:leads.filter(l=>["call_agendada","call_realizada"].includes(l.status)).length,fechados:leads.filter(l=>l.status==="fechado").length};

  const badge=(q)=>q&&QUAL[q]?<span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:QUAL[q].bg,color:QUAL[q].color,border:`1px solid ${QUAL[q].border}`,whiteSpace:"nowrap"}}>{QUAL[q].label}</span>:null;

  return(<>
    <style>{G}</style>
    <div style={{minHeight:"100vh",background:"#F8F9FB"}}>

      <header style={{borderBottom:"1px solid #E8ECF0",padding:"0 28px",display:"flex",alignItems:"center",justifyContent:"space-between",height:56,position:"sticky",top:0,background:"rgba(248,249,251,0.95)",backdropFilter:"blur(12px)",zIndex:40}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:15,fontFamily:"'Instrument Serif',serif",color:"#0F172A"}}>FIT Global English</span>
          <span style={{width:1,height:14,background:"#D1D9E0",display:"inline-block"}}/>
          <span style={{fontSize:11,color:"#94A3B8",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase"}}>CRM</span>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {["kanban","lista"].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:"5px 14px",borderRadius:6,fontSize:12,fontWeight:500,background:view===v?"#fff":"transparent",color:view===v?"#0F172A":"#94A3B8",border:view===v?"1px solid #D1D9E0":"1px solid transparent",boxShadow:view===v?"0 1px 3px rgba(0,0,0,0.06)":"none"}}>
              {v==="kanban"?"Kanban":"Lista"}
            </button>
          ))}
          <button onClick={()=>setMnovo(true)} style={{padding:"5px 16px",borderRadius:6,fontSize:12,fontWeight:600,background:"#2563EB",color:"#fff",marginLeft:8,boxShadow:"0 1px 4px rgba(37,99,235,0.3)"}}>+ Lead</button>
        </div>
      </header>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",borderBottom:"1px solid #E8ECF0",background:"#fff"}}>
        {[{l:"Total",v:st.total,s:"leads",a:"#2563EB"},{l:"Alta qualidade",v:st.alta,s:"leads",a:"#16A34A"},{l:"Calls",v:st.calls,s:"agendadas",a:"#7C3AED"},{l:"Fechados",v:st.fechados,s:"alunos",a:"#D97706"}].map((s,i)=>(
          <div key={i} style={{padding:"22px 28px",borderRight:i<3?"1px solid #E8ECF0":"none"}}>
            <div style={{fontSize:11,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:500,marginBottom:8}}>{s.l}</div>
            <div style={{display:"flex",alignItems:"baseline",gap:6}}>
              <span style={{fontSize:34,fontFamily:"'Instrument Serif',serif",color:s.a,lineHeight:1}}>{s.v}</span>
              <span style={{fontSize:12,color:"#94A3B8"}}>{s.s}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:8,padding:"12px 28px",alignItems:"center",borderBottom:"1px solid #E8ECF0",background:"#fff"}}>
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por nome ou WhatsApp..." style={{flex:1,maxWidth:280,padding:"7px 12px",fontSize:13}}/>
        <div style={{display:"flex",gap:4}}>
          {["todos","alta","media_alta","media","baixa"].map(q=>(
            <button key={q} onClick={()=>setFq(q)} style={{padding:"5px 12px",borderRadius:20,fontSize:12,fontWeight:500,background:fq===q?(QUAL[q]?.bg||"#EFF6FF"):"transparent",color:fq===q?(QUAL[q]?.color||"#2563EB"):"#94A3B8",border:fq===q?`1px solid ${QUAL[q]?.border||"#BFDBFE"}`:"1px solid transparent"}}>
              {q==="todos"?"Todos":QUAL[q]?.label}
            </button>
          ))}
        </div>
        <button onClick={fetchLeads} style={{padding:"6px 10px",borderRadius:8,background:"#F4F5F7",color:"#94A3B8",fontSize:14,border:"1px solid #E8ECF0"}}>↻</button>
      </div>

      {loading&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200}}><span style={{fontSize:13,color:"#94A3B8"}}>Carregando leads...</span></div>}
      {err&&<div style={{padding:"10px 28px",fontSize:12,color:"#DC2626",background:"#FEF2F2",borderBottom:"1px solid #FECACA"}}>{err}</div>}

      {!loading&&view==="kanban"&&(
        <div style={{display:"flex",gap:0,padding:"24px 28px",overflowX:"auto",alignItems:"flex-start"}}>
          {FUNIL.map(status=>{
            const col=ps(status);const s=STATUS[status];
            return(
              <div key={status} style={{minWidth:220,marginRight:10,flexShrink:0}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:s.dot}}/>
                    <span style={{fontSize:11,fontWeight:600,color:"#475569",letterSpacing:"0.05em",textTransform:"uppercase"}}>{s.label}</span>
                  </div>
                  <span style={{fontSize:11,color:"#94A3B8",background:"#F4F5F7",padding:"1px 7px",borderRadius:10,border:"1px solid #E8ECF0"}}>{col.length}</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {col.map(lead=>(
                    <div key={lead.id} className="c" draggable onDragStart={e=>{e.dataTransfer.setData("id",lead.id);e.dataTransfer.setData("status",lead.status);e.currentTarget.style.opacity="0.4"}} onDragEnd={e=>e.currentTarget.style.opacity="1"} onClick={()=>abrir(lead)} style={{background:"#fff",border:"1px solid #E8ECF0",borderRadius:10,padding:"12px 14px",cursor:"pointer",borderLeft:`3px solid ${QUAL[lead.qualificacao]?.color||"#E8ECF0"}`,boxShadow:"0 1px 3px rgba(0,0,0,0.04)",transition:"all .15s"}}
                      onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,0.08)";e.currentTarget.style.borderColor="#D1D9E0";}}
                      onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.04)";e.currentTarget.style.borderColor="#E8ECF0";}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:5}}>
                        <span style={{fontSize:13,fontWeight:600,color:"#0F172A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lead.nome||"—"}</span>
                        {badge(lead.qualificacao)}
                      </div>
                      {lead.profissao&&<div style={{fontSize:11,color:"#94A3B8",marginBottom:3}}>{lead.profissao}</div>}
                      {lead.whatsapp&&<div style={{fontSize:11,color:"#94A3B8"}}>{lead.whatsapp}</div>}
                      {lead.pais&&lead.pais!=="brasil"&&<div style={{fontSize:10,color:"#2563EB",marginTop:5,fontWeight:500}}>🌍 {lead.pais}</div>}
                    </div>
                  ))}
                  {col.length===0&&<div style={{fontSize:12,color:"#CBD5E1",textAlign:"center",padding:"20px 0",border:"1px dashed #E8ECF0",borderRadius:10,background:"#fff"}}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading&&view==="lista"&&(
        <div style={{padding:"24px 28px"}}>
          <div style={{border:"1px solid #E8ECF0",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 100px 140px 1fr",padding:"10px 18px",borderBottom:"1px solid #E8ECF0",background:"#F8F9FB"}}>
              {["Nome","Profissão","Qualidade","Status","WhatsApp"].map(h=><span key={h} style={{fontSize:10,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.08em"}}>{h}</span>)}
            </div>
            {lf.map((lead,i)=>(
              <div key={lead.id} className="c" onClick={()=>abrir(lead)} style={{display:"grid",gridTemplateColumns:"2fr 1fr 100px 140px 1fr",padding:"12px 18px",borderBottom:i<lf.length-1?"1px solid #E8ECF0":"none",cursor:"pointer",alignItems:"center",background:"#fff",transition:"background .1s"}}
                onMouseEnter={e=>e.currentTarget.style.background="#F8F9FB"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                <span style={{fontSize:13,fontWeight:600,color:"#0F172A"}}>{lead.nome}</span>
                <span style={{fontSize:12,color:"#475569"}}>{lead.profissao||"—"}</span>
                {badge(lead.qualificacao)}
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:STATUS[lead.status]?.dot,flexShrink:0}}/>
                  <span style={{fontSize:12,color:"#475569"}}>{STATUS[lead.status]?.label}</span>
                </div>
                <span style={{fontSize:12,color:"#94A3B8"}}>{lead.whatsapp||"—"}</span>
              </div>
            ))}
            {lf.length===0&&<div style={{padding:40,textAlign:"center",color:"#94A3B8",fontSize:13}}>Nenhum lead encontrado</div>}
          </div>
        </div>
      )}

      {sel&&(
        <div style={{position:"fixed",inset:0,zIndex:50,display:"flex",justifyContent:"flex-end"}} onClick={()=>setSel(null)}>
          <div style={{position:"absolute",inset:0,background:"rgba(15,23,42,0.25)",backdropFilter:"blur(3px)"}}/>
          <div className="p" onClick={e=>e.stopPropagation()} style={{width:460,height:"100%",overflowY:"auto",background:"#fff",borderLeft:"1px solid #E8ECF0",position:"relative",zIndex:1,boxShadow:"-8px 0 32px rgba(0,0,0,0.08)"}}>
            <div style={{padding:"24px 24px 18px",borderBottom:"1px solid #E8ECF0",position:"sticky",top:0,background:"#fff",zIndex:2}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <h2 style={{fontSize:20,fontFamily:"'Instrument Serif',serif",fontWeight:400,color:"#0F172A",marginBottom:3}}>{sel.nome}</h2>
                  <div style={{fontSize:12,color:"#94A3B8"}}>{sel.profissao||"Profissão não informada"}{sel.pais&&sel.pais!=="brasil"?` · ${sel.pais}`:""}</div>
                </div>
                <button onClick={()=>setSel(null)} style={{background:"#F4F5F7",border:"1px solid #E8ECF0",color:"#475569",width:30,height:30,borderRadius:8,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
              </div>
            </div>
            <div style={{padding:24,display:"flex",flexDirection:"column",gap:20}}>
              <div>
                <div style={{fontSize:10,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Qualificação</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {Object.entries(QUAL).map(([k,v])=>(
                    <button key={k} onClick={()=>upd(sel.id,"qualificacao",k)} style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,background:sel.qualificacao===k?v.bg:"transparent",color:sel.qualificacao===k?v.color:"#94A3B8",border:sel.qualificacao===k?`1px solid ${v.border}`:"1px solid #E8ECF0"}}>{v.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Status no funil</div>
                <select value={sel.status} onChange={e=>upd(sel.id,"status",e.target.value)} style={{width:"100%",padding:"8px 12px",fontSize:13,borderRadius:8}}>
                  {Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div style={{background:"#F8F9FB",borderRadius:10,padding:16,border:"1px solid #E8ECF0"}}>
                <div style={{fontSize:10,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14}}>Dados do formulário</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {[["WhatsApp",sel.whatsapp],["Instagram",sel.instagram],["Objetivo",sel.objetivo],["Nível",sel.nivel?.replace("nivel_","Nível ")],["País",sel.pais],["Bloqueio",sel.bloqueio],["Por que aprender",sel.motivo_aprender],["O que mudaria",sel.o_que_mudaria],["Chamou atenção",sel.chamou_atencao],["Horários",sel.horarios_disponiveis?.join(", ")],["Dias",sel.dias_disponiveis?.join(", ")],["Investir",sel.disposto_investir],["Info extra",sel.info_adicional]].filter(([,v])=>v).map(([l,v])=>(
                    <div key={l} style={{display:"grid",gridTemplateColumns:"110px 1fr",gap:8,alignItems:"flex-start"}}>
                      <span style={{fontSize:11,color:"#94A3B8",fontWeight:500,paddingTop:1}}>{l}</span>
                      <span style={{fontSize:12,color:"#475569",lineHeight:1.5}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Observações</div>
                <textarea defaultValue={sel.observacoes_qualificacao||""} onBlur={e=>upd(sel.id,"observacoes_qualificacao",e.target.value)} placeholder="Anotações sobre esse lead..." style={{width:"100%",padding:"10px 12px",fontSize:13,borderRadius:8,resize:"vertical",minHeight:80,lineHeight:1.6}}/>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Histórico de contato</div>
                <div style={{display:"flex",gap:6,marginBottom:8}}>
                  <select value={tipo} onChange={e=>setTipo(e.target.value)} style={{padding:"7px 10px",fontSize:12,borderRadius:8,flexShrink:0}}>
                    <option value="mensagem_whatsapp">WhatsApp</option>
                    <option value="resposta_lead">Resposta</option>
                    <option value="call">Call</option>
                    <option value="anotacao">Nota</option>
                  </select>
                  <input value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Registrar contato..." onKeyDown={e=>e.key==="Enter"&&addHist()} style={{flex:1,padding:"7px 10px",fontSize:13,borderRadius:8}}/>
                  <button onClick={addHist} disabled={salv} style={{padding:"7px 14px",borderRadius:8,background:"#2563EB",color:"#fff",fontSize:13,fontWeight:600,opacity:salv?0.6:1}}>+</button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:280,overflowY:"auto"}}>
                  {hist.map(h=>(
                    <div key={h.id} style={{padding:"10px 12px",background:"#F8F9FB",borderRadius:8,border:"1px solid #E8ECF0"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <span style={{fontSize:10,color:"#2563EB",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>{h.tipo?.replace(/_/g," ")}</span>
                        <span style={{fontSize:10,color:"#94A3B8"}}>{new Date(h.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <div style={{fontSize:12,color:"#475569",lineHeight:1.5}}>{h.conteudo}</div>
                    </div>
                  ))}
                  {hist.length===0&&<div style={{fontSize:12,color:"#94A3B8",textAlign:"center",padding:16}}>Nenhum contato registrado</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {mnovo&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.35)",zIndex:60,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}} onClick={()=>setMnovo(false)}>
          <div className="c" onClick={e=>e.stopPropagation()} style={{background:"#fff",border:"1px solid #E8ECF0",borderRadius:14,padding:28,width:380,boxShadow:"0 20px 60px rgba(0,0,0,0.12)"}}>
            <h3 style={{fontSize:18,fontFamily:"'Instrument Serif',serif",fontWeight:400,marginBottom:20,color:"#0F172A"}}>Novo Lead</h3>
            {[["Nome completo","nome"],["WhatsApp","whatsapp"],["Instagram","instagram"]].map(([label,field])=>(
              <div key={field} style={{marginBottom:12}}>
                <div style={{fontSize:11,color:"#94A3B8",marginBottom:5,fontWeight:500}}>{label}</div>
                <input value={nlead[field]} onChange={e=>setNlead(p=>({...p,[field]:e.target.value}))} style={{width:"100%",padding:"8px 12px",fontSize:13,borderRadius:8}}/>
              </div>
            ))}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,color:"#94A3B8",marginBottom:5,fontWeight:500}}>Qualificação</div>
              <select value={nlead.qualificacao} onChange={e=>setNlead(p=>({...p,qualificacao:e.target.value}))} style={{width:"100%",padding:"8px 12px",fontSize:13,borderRadius:8}}>
                {Object.entries(QUAL).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>setMnovo(false)} style={{padding:"8px 16px",borderRadius:8,background:"transparent",border:"1px solid #E8ECF0",color:"#475569",fontSize:13}}>Cancelar</button>
              <button onClick={criar} disabled={salv||!nlead.nome.trim()} style={{padding:"8px 20px",borderRadius:8,background:"#2563EB",color:"#fff",fontSize:13,fontWeight:600,opacity:salv?0.6:1}}>Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  </>);
}
