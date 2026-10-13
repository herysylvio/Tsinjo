import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Get current month transactions
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

    const { data: transactions } = await supabase
      .from("transactions")
      .select("type, amount, category")
      .eq("user_id", userId)
      .gte("transaction_date", startOfMonth)
      .order("transaction_date", { ascending: false });

    // Get profile for language
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, preferred_language")
      .eq("user_id", userId)
      .single();

    let totalIncome = 0;
    let totalExpense = 0;
    const categorySums: Record<string, number> = {};

    (transactions || []).forEach((t: any) => {
      if (t.type === "income") totalIncome += Number(t.amount);
      else totalExpense += Number(t.amount);
      categorySums[t.category] = (categorySums[t.category] || 0) + Number(t.amount);
    });

    const lang = profile?.preferred_language === "mg" ? "malgache" : "français";
    const userName = profile?.display_name || "utilisateur";

    const prompt = `Tu es Tsinjo AI, coach financier pour les familles à Madagascar. Réponds en ${lang}.

Profil financier de ${userName} ce mois-ci :
- Revenus : ${totalIncome.toLocaleString()} Ar
- Dépenses : ${totalExpense.toLocaleString()} Ar
- Solde : ${(totalIncome - totalExpense).toLocaleString()} Ar
- Catégories de dépenses : ${JSON.stringify(categorySums)}

Donne UN SEUL conseil financier court (1-2 phrases max), personnalisé et actionnable, adapté au contexte économique malgache. Utilise un emoji au début. Ne répète pas les chiffres, donne directement le conseil.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "rate_limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "payment_required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", response.status, await response.text());
      return new Response(JSON.stringify({ error: "ai_error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const tip = data.choices?.[0]?.message?.content?.trim() || null;

    return new Response(JSON.stringify({ tip }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-tip error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
