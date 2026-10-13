import { useTranslation } from "react-i18next";
import { Bell, BellOff, Smartphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useReminders, type ReminderType } from "@/hooks/useReminders";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { toast } from "sonner";

const TYPES: { type: ReminderType; hasTime: boolean }[] = [
  { type: "daily_entry", hasTime: true },
  { type: "recurring_due", hasTime: true },
  { type: "weekly_recap", hasTime: true },
  { type: "inactivity", hasTime: false },
];

function isIos() {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true
  );
}

export function RemindersSection() {
  const { t } = useTranslation();
  const { reminders, update, isLoading } = useReminders();
  const {
    isSupported,
    isSubscribed,
    permission,
    loading,
    subscribe,
    unsubscribe,
  } = usePushSubscription();

  const iosWithoutPwa = isIos() && !isStandalone();

  const toggleGlobal = async (next: boolean) => {
    if (next) {
      const ok = await subscribe();
      if (ok) toast.success(t("settings.reminders.enabled_toast"));
      else toast.error(t("settings.reminders.permission_denied"));
    } else {
      await unsubscribe();
      toast.success(t("settings.reminders.disabled_toast"));
    }
  };

  const quietRow = reminders[0]; // share quiet hours via first reminder for simplicity

  const updateQuiet = (field: "quiet_start" | "quiet_end", value: string) => {
    for (const r of reminders) {
      update({ id: r.id, [field]: value });
    }
  };

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">
            {t("settings.reminders.title")}
          </span>
        </div>

        {!isSupported && (
          <div className="mb-3 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            {t("settings.reminders.not_supported")}
          </div>
        )}

        {iosWithoutPwa && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t("settings.reminders.ios_pwa_hint")}</span>
          </div>
        )}

        {/* Global toggle */}
        <div className="mb-4 flex items-center justify-between rounded-lg border border-border p-3">
          <div className="flex items-center gap-3">
            {isSubscribed ? (
              <Bell className="h-4 w-4 text-primary" />
            ) : (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-medium">
                {t("settings.reminders.global")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("settings.reminders.global_desc")}
              </p>
            </div>
          </div>
          <Switch
            checked={isSubscribed}
            disabled={!isSupported || loading || permission === "denied"}
            onCheckedChange={toggleGlobal}
          />
        </div>

        {permission === "denied" && (
          <p className="-mt-2 mb-3 text-xs text-destructive">
            {t("settings.reminders.permission_blocked")}
          </p>
        )}

        {/* Per-reminder cards */}
        <div className="space-y-2">
          {TYPES.map(({ type, hasTime }) => {
            const r = reminders.find((x) => x.type === type);
            if (!r) return null;
            return (
              <div
                key={type}
                className="rounded-lg border border-border p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {t(`settings.reminders.types.${type}.title`)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(`settings.reminders.types.${type}.desc`)}
                    </p>
                  </div>
                  <Switch
                    checked={r.enabled}
                    disabled={!isSubscribed || isLoading}
                    onCheckedChange={(v) =>
                      update({ id: r.id, enabled: v })}
                  />
                </div>
                {hasTime && r.enabled && (
                  <div className="mt-3 flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">
                      {t("settings.reminders.time")}
                    </Label>
                    <Input
                      type="time"
                      value={r.time}
                      className="h-8 w-32"
                      onChange={(e) =>
                        update({ id: r.id, time: e.target.value })}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quiet hours */}
        {quietRow && (
          <div className="mt-4 rounded-lg border border-border p-3">
            <p className="mb-2 text-sm font-medium">
              {t("settings.reminders.quiet_hours")}
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              {t("settings.reminders.quiet_hours_desc")}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">
                  {t("settings.reminders.from")}
                </Label>
                <Input
                  type="time"
                  value={quietRow.quiet_start}
                  className="h-8 w-32"
                  onChange={(e) => updateQuiet("quiet_start", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">
                  {t("settings.reminders.to")}
                </Label>
                <Input
                  type="time"
                  value={quietRow.quiet_end}
                  className="h-8 w-32"
                  onChange={(e) => updateQuiet("quiet_end", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
