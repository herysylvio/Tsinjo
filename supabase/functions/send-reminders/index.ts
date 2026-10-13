// Cron-driven reminder dispatcher. Triggered every 15 min by pg_cron.
// For each enabled user_reminders row whose local time matches the current
// 15-min window, builds a payload and sends a Web Push to all the user's
// registered subscriptions using web-push (npm).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ReminderType =
  | "daily_entry"
  | "recurring_due"
  | "weekly_recap"
  | "inactivity";

interface Reminder {
  id: string;
  user_id: string;
  type: ReminderType;
  enabled: boolean;
  time: string; // HH:MM
  timezone: string;
  quiet_start: string;
  quiet_end: string;
  last_sent_at: string | null;
}

interface PushSub {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

function getLocalParts(date: Date, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour === "24" ? "00" : map.hour,
    minute: map.minute,
    weekday: map.weekday, // e.g. "Sun"
    isoDate: `${map.year}-${map.month}-${map.day}`,
    minutesOfDay: parseInt(map.hour === "24" ? "00" : map.hour) * 60 +
      parseInt(map.minute),
  };
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function isInQuietHours(nowMin: number, qsMin: number, qeMin: number) {
  if (qsMin === qeMin) return false;
  if (qsMin < qeMin) return nowMin >= qsMin && nowMin < qeMin;
  // Wraps midnight
  return nowMin >= qsMin || nowMin < qeMin;
}

async function buildPayload(
  supabase: ReturnType<typeof createClient>,
  reminder: Reminder,
  localIsoDate: string,
): Promise<{ title: string; body: string; url: string } | null> {
  const baseUrl = "/";

  switch (reminder.type) {
    case "daily_entry":
      return {
        title: "Tsinjo — Saisie du jour",
        body: "N'oublie pas d'enregistrer tes dépenses et revenus d'aujourd'hui.",
        url: "/transactions",
      };

    case "recurring_due": {
      // Check tomorrow's manual recurring_pending
      const tomorrow = new Date(localIsoDate + "T00:00:00Z");
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const tomorrowIso = tomorrow.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("recurring_pending")
        .select("id, description, amount, type")
        .eq("user_id", reminder.user_id)
        .eq("due_date", tomorrowIso);

      if (error || !data || data.length === 0) return null;
      const count = data.length;
      return {
        title: "Tsinjo — Échéances de demain",
        body: count === 1
          ? `1 transaction récurrente arrive demain.`
          : `${count} transactions récurrentes arrivent demain.`,
        url: "/transactions",
      };
    }

    case "weekly_recap": {
      // Only on Sunday
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: reminder.timezone,
        weekday: "short",
      });
      const weekday = fmt.format(new Date());
      if (weekday !== "Sun") return null;

      const sevenDaysAgo = new Date(localIsoDate + "T00:00:00Z");
      sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
      const fromIso = sevenDaysAgo.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("transactions")
        .select("amount, type")
        .eq("user_id", reminder.user_id)
        .gte("transaction_date", fromIso);

      if (error) return null;
      let income = 0;
      let expense = 0;
      for (const t of data ?? []) {
        if (t.type === "income") income += Number(t.amount);
        else expense += Number(t.amount);
      }
      const fmtAr = (n: number) =>
        new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " Ar";
      return {
        title: "Tsinjo — Récap de la semaine",
        body: `Revenus : ${fmtAr(income)} • Dépenses : ${fmtAr(expense)}`,
        url: "/",
      };
    }

    case "inactivity": {
      const threeDaysAgo = new Date(localIsoDate + "T00:00:00Z");
      threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);
      const cutoffIso = threeDaysAgo.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("transactions")
        .select("transaction_date")
        .eq("user_id", reminder.user_id)
        .order("transaction_date", { ascending: false })
        .limit(1);

      if (error) return null;
      const last = data?.[0]?.transaction_date as string | undefined;
      if (last && last > cutoffIso) return null;

      return {
        title: "Tsinjo — On t'a perdu ?",
        body: "Aucune saisie depuis 3 jours. Garde le contrôle de tes finances.",
        url: "/transactions",
      };
    }
  }
  return baseUrl ? null : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ??
      "mailto:contact@tsinjo.app";

    if (!vapidPublic || !vapidPrivate) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: reminders, error } = await supabase
      .from("user_reminders")
      .select("*")
      .eq("enabled", true);

    if (error) throw error;

    const now = new Date();
    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const r of (reminders ?? []) as Reminder[]) {
      const local = getLocalParts(now, r.timezone || "Indian/Antananarivo");
      const targetMin = timeToMinutes(r.time || "20:00");
      const nowMin = local.minutesOfDay;

      // 15-min window: trigger when targetMin in [nowMin-15, nowMin]
      const inWindow = nowMin - targetMin >= 0 && nowMin - targetMin < 15;
      if (!inWindow) {
        skipped++;
        continue;
      }

      // Quiet hours
      const qs = timeToMinutes(r.quiet_start || "22:00");
      const qe = timeToMinutes(r.quiet_end || "07:00");
      if (isInQuietHours(nowMin, qs, qe)) {
        skipped++;
        continue;
      }

      // Already sent today?
      if (r.last_sent_at) {
        const lastLocal = getLocalParts(
          new Date(r.last_sent_at),
          r.timezone || "Indian/Antananarivo",
        );
        if (lastLocal.isoDate === local.isoDate) {
          skipped++;
          continue;
        }
      }

      const payload = await buildPayload(supabase, r, local.isoDate);
      if (!payload) {
        skipped++;
        continue;
      }

      // Fetch subscriptions
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", r.user_id);

      if (!subs || subs.length === 0) {
        skipped++;
        continue;
      }

      const payloadStr = JSON.stringify({
        ...payload,
        icon: "/pwa-icon-192.png",
      });

      let anySent = false;
      for (const s of subs as PushSub[]) {
        try {
          await webpush.sendNotification(
            {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth },
            },
            payloadStr,
          );
          anySent = true;
          sent++;
        } catch (e: unknown) {
          const err = e as { statusCode?: number; message?: string };
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", s.id);
          } else {
            errors.push(`sub ${s.id}: ${err.message ?? String(e)}`);
          }
        }
      }

      if (anySent) {
        await supabase
          .from("user_reminders")
          .update({ last_sent_at: new Date().toISOString() })
          .eq("id", r.id);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent, skipped, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
