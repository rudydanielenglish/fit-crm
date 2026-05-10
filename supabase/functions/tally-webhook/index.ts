import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const NIVEL_MAP: Record<string, string> = {
  "Nível 1 (Iniciante/Zero ou muito pouco)": "nivel_1",
  "Nível 2 (Entende algo, mas fala pouco)": "nivel_2",
  "Nível 3 (Entende bem, consegue falar bastante mas falta refinar)": "nivel_3",
};

function detectarPais(whatsapp: string): string {
  if (!whatsapp) return "brasil";
  if (whatsapp.startsWith("+55")) return "brasil";
  if (whatsapp.startsWith("+351")) return "portugal";
  if (whatsapp.startsWith("+353")) return "irlanda";
  if (whatsapp.startsWith("+244")) return "angola";
  if (whatsapp.startsWith("+1")) return "eua_canada";
  if (whatsapp.startsWith("+64")) return "nova_zelandia";
  if (whatsapp.startsWith("+31")) return "holanda";
  return "outro";
}

function extrairValor(field: any): string {
  if (!field) return "";
  const val = field.value;
  if (typeof val === "string") return val;
  if (typeof val === "boolean") return val ? "true" : "false";
  if (Array.isArray(val) && field.options) {
    return val.map((id: string) => {
      const opt = field.options.find((o: any) => o.id === id);
      return opt?.text || id;
    }).join(", ");
  }
  if (Array.isArray(val)) return val.join(", ");
  return val?.toString() || "";
}

function encontrarCampo(fields: any[], label: string): any {
  return fields.find((f: any) => f.label?.toLowerCase().includes(label.toLowerCase()));
}

function calcularQualificacao(dados: any): { score: number; qualificacao: string } {
  let score = 0;
  if (dados.objetivo === "profissional") score += 2;
  if (dados.disposto_investir === "sim") score += 3;
  else if (dados.disposto_investir === "talvez") score += 1;
  if (dados.ja_investiu) score += 2;
  if (dados.decisor_unico) score += 2;
  if (detectarPais(dados.whatsapp) !== "brasil") score += 2;
  if (dados.nivel === "nivel_2" || dados.nivel === "nivel_3") score += 1;
  let qualificacao = "baixa";
  if (score >= 9) qualificacao = "alta";
  else if (score >= 6) qualificacao = "media_alta";
  else if (score >= 3) qualificacao = "media";
  return { score, qualificacao };
}

serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const body = await req.json();
    const fields = body?.data?.fields || [];

    const whatsapp = extrairValor(encontrarCampo(fields, "WhatsApp"));
    const inicio_raw = extrairValor(encontrarCampo(fields, "início imediato")).toLowerCase();
    const inicio_imediato = inicio_raw === "sim";
    const objetivo_raw = extrairValor(encontrarCampo(fields, "profissional ou viagem")).toLowerCase();
    const objetivo = objetivo_raw.includes("profissional") ? "profissional" : "viagem";
    const ja_investiu_raw = extrairValor(encontrarCampo(fields, "já investiu")).toLowerCase();
    const ja_investiu = ja_investiu_raw.includes("já investi");
    const disposto_raw = extrairValor(encontrarCampo(fields, "disposto a investir")).toLowerCase();
    const disposto_investir = disposto_raw.includes("pronto") ? "sim" : disposto_raw.includes("talvez") ? "talvez" : "nao";
    const nivel_raw = extrairValor(encontrarCampo(fields, "nível de inglês"));
    const nivel = NIVEL_MAP[nivel_raw] || "nivel_1";
    const decisor_raw = extrairValor(encontrarCampo(fields, "decisão financeira")).toLowerCase();
    const decisor_unico = decisor_raw === "sim";

    const { score, qualificacao } = calcularQualificacao({ objetivo, disposto_investir, ja_investiu, decisor_unico, whatsapp, nivel });

    const lead = {
      nome: extrairValor(encontrarCampo(fields, "nome e sobrenome")) || "Sem nome",
      whatsapp,
      instagram: extrairValor(encontrarCampo(fields, "Instagram")),
      inicio_imediato,
      objetivo,
      chamou_atencao: extrairValor(encontrarCampo(fields, "chamou sua atenção")),
      bloqueio: extrairValor(encontrarCampo(fields, "maior bloqueio")),
      profissao: extrairValor(encontrarCampo(fields, "profissão")),
      motivo_aprender: extrairValor(encontrarCampo(fields, "importante pra você agora")),
      o_que_mudaria: extrairValor(encontrarCampo(fields, "mudaria na sua vida")),
      treino_diario: extrairValor(encontrarCampo(fields, "15 minutos")).toLowerCase() === "sim",
      ja_investiu,
      disposto_investir,
      nivel,
      dias_disponiveis: [extrairValor(encontrarCampo(fields, "dias você pode"))].filter(Boolean),
      horarios_disponiveis: [extrairValor(encontrarCampo(fields, "horários você pode"))].filter(Boolean),
      so_para_voce: extrairValor(encontrarCampo(fields, "só para você")).toLowerCase() === "sim",
      decisor_financeiro: decisor_raw,
      info_adicional: extrairValor(encontrarCampo(fields, "mais alguma coisa")),
      pais: detectarPais(whatsapp),
      score,
      qualificacao,
      status: inicio_imediato ? "novo" : "arquivado",
      submitted_at: body?.data?.createdAt || new Date().toISOString(),
    };

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const res = await fetch(`${supabaseUrl}/rest/v1/leads`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(lead),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Erro ao salvar:", err);
      return new Response(JSON.stringify({ error: err }), { status: 500 });
    }

    const saved = await res.json();
    console.log("Lead salvo:", saved[0]?.id);
    return new Response(JSON.stringify({ ok: true, id: saved[0]?.id }), { status: 200 });
  } catch (e: any) {
    console.error("Erro:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
