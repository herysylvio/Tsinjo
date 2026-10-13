import { Bell, AlertTriangle, Check, X, CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/hooks/useNotifications';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const renderCategoryLabel = (cat: string, t: (k: string, d?: string) => string): string => {
  if (cat.startsWith('other_expense:')) return cat.substring('other_expense:'.length);
  if (cat.startsWith('other_income:')) return cat.substring('other_income:'.length);
  if (cat.startsWith('custom:')) return cat.substring('custom:'.length);
  return t(`transactions.categories.${cat}`, cat);
};

const NotificationBell = () => {
  const { t } = useTranslation();
  const { alerts, pending, unseenCount, markAllSeen, confirmPending, dismissPending, confirmAll } =
    useNotifications();

  const hasContent = alerts.length > 0 || pending.length > 0;

  return (
    <Popover onOpenChange={(open) => { if (open) markAllSeen(); }}>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unseenCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center"
            >
              {unseenCount}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 max-w-[calc(100vw-1rem)]">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h4 className="text-sm font-semibold">{t('notifications.title', 'Notifications')}</h4>
          {pending.length > 1 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => confirmAll.mutate()}
              disabled={confirmAll.isPending}
            >
              {t('notifications.confirm_all', 'Tout confirmer')}
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {!hasContent ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t('notifications.empty', 'Aucune alerte')}
            </div>
          ) : (
            <>
              {pending.length > 0 && (
                <>
                  <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground bg-muted/40">
                    {t('notifications.pending_section', 'À confirmer')}
                  </div>
                  {pending.map((p) => (
                    <div key={p.id} className="flex items-start gap-2 p-3 border-b border-border last:border-0">
                      <CalendarClock className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {renderCategoryLabel(p.category, t as unknown as (k: string, d?: string) => string)}
                        </p>
                        <p className={`text-xs ${p.type === 'expense' ? 'text-destructive' : 'text-success'}`}>
                          {p.type === 'expense' ? '-' : '+'}{Number(p.amount).toLocaleString()} Ar
                          {' · '}
                          {format(parseISO(p.due_date), 'd MMM yyyy', { locale: fr })}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-success hover:text-success"
                          onClick={() => confirmPending.mutate(p)}
                          disabled={confirmPending.isPending}
                          aria-label={t('notifications.confirm', 'Confirmer')}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => dismissPending.mutate(p.id)}
                          disabled={dismissPending.isPending}
                          aria-label={t('notifications.dismiss', 'Ignorer')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {alerts.length > 0 && <Separator />}
                </>
              )}
              {alerts.length > 0 && (
                <>
                  <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground bg-muted/40">
                    {t('notifications.budgets_section', 'Budgets')}
                  </div>
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-3 p-3 border-b border-border last:border-0"
                    >
                      <AlertTriangle
                        className={`h-4 w-4 mt-0.5 shrink-0 ${
                          alert.severity === 'exceeded' ? 'text-destructive' : 'text-orange-500'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {t(`transactions.categories.${alert.category}`, alert.category)}
                        </p>
                        <p className={`text-xs ${alert.severity === 'exceeded' ? 'text-destructive' : 'text-orange-500'}`}>
                          {alert.spent.toLocaleString()} / {alert.limit.toLocaleString()} Ar
                          {alert.severity === 'exceeded' && (
                            <> — +{(alert.spent - alert.limit).toLocaleString()} Ar</>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
