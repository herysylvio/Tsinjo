import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function addInterval(date: Date, frequency: string): Date {
  const d = new Date(date);
  switch (frequency) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "bimonthly":
      d.setMonth(d.getMonth() + 2);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "semi_annual":
      d.setMonth(d.getMonth() + 6);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
    case "monthly":
    default:
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return d;
}

const toDateStr = (d: Date) => d.toISOString().split("T")[0];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Optional: process for a single recurring (when called right after create)
    let onlyRecurringId: string | undefined;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.recurring_id) onlyRecurringId = body.recurring_id;
      } catch (_) { /* ignore */ }
    }

    const today = new Date();
    const todayStr = toDateStr(today);

    let query = supabase
      .from("recurring_transactions")
      .select("*")
      .eq("is_active", true)
      .lte("next_due_date", todayStr);

    if (onlyRecurringId) query = query.eq("id", onlyRecurringId);

    const { data: recurring, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    let processed = 0;
    let pendingCreated = 0;
    let autoInserted = 0;

    for (const rec of recurring ?? []) {
      let cursor = new Date(rec.next_due_date);
      const occurrences: string[] = [];

      // Collect all due dates up to today (inclusive)
      while (toDateStr(cursor) <= todayStr) {
        occurrences.push(toDateStr(cursor));
        cursor = addInterval(cursor, rec.frequency);
        if (occurrences.length > 500) break; // safety
      }

      if (occurrences.length === 0) continue;

      const mode = rec.confirmation_mode ?? "manual";

      if (mode === "auto") {
        const rows = occurrences.map((due) => ({
          user_id: rec.user_id,
          account_id: rec.account_id,
          type: rec.type,
          amount: rec.amount,
          category: rec.category,
          description: rec.description,
          transaction_date: due,
        }));
        const { error } = await supabase.from("transactions").insert(rows);
        if (error) {
          console.error(`auto insert failed for ${rec.id}:`, error);
          continue;
        }
        autoInserted += rows.length;
      } else {
        const rows = occurrences.map((due) => ({
          recurring_id: rec.id,
          user_id: rec.user_id,
          account_id: rec.account_id,
          type: rec.type,
          amount: rec.amount,
          category: rec.category,
          description: rec.description,
          due_date: due,
        }));
        const { error } = await supabase.from("recurring_pending").insert(rows);
        if (error) {
          console.error(`pending insert failed for ${rec.id}:`, error);
          continue;
        }
        pendingCreated += rows.length;
      }

      const { error: updateError } = await supabase
        .from("recurring_transactions")
        .update({ next_due_date: toDateStr(cursor) })
        .eq("id", rec.id);

      if (updateError) {
        console.error(`update next_due_date failed for ${rec.id}:`, updateError);
      } else {
        processed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed, pendingCreated, autoInserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("process-recurring error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
