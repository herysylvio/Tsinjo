import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccounts } from '@/hooks/useAccounts';
import { Card, CardContent } from '@/components/ui/card';
import { Layers, Wallet, Users } from 'lucide-react';
import AnimatedNumber from '@/components/AnimatedNumber';

const GlobalBalanceSummary = ({ discreet }: { discreet?: boolean }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { ownAccounts, sharedAccounts } = useAccounts();

  // Personal accounts balance (filter by user_id)
  const { data: personalBalance } = useQuery({
    queryKey: ['global-balance-personal', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('type, amount, account_id')
        .eq('user_id', user!.id);
      if (error) throw error;

      const byAccount: Record<string, { income: number; expense: number }> = {};
      let totalIncome = 0;
      let totalExpense = 0;

      for (const tx of data) {
        const amt = Number(tx.amount);
        if (tx.type === 'income') totalIncome += amt;
        else totalExpense += amt;

        const accId = tx.account_id || 'default';
        if (!byAccount[accId]) byAccount[accId] = { income: 0, expense: 0 };
        if (tx.type === 'income') byAccount[accId].income += amt;
        else byAccount[accId].expense += amt;
      }

      return { totalIncome, totalExpense, totalBalance: totalIncome - totalExpense, byAccount };
    },
    enabled: !!user,
  });

  // Shared accounts balances (filter by account_id, no user_id filter — RLS handles access)
  const { data: sharedBalances } = useQuery({
    queryKey: ['global-balance-shared', user?.id, sharedAccounts.map(a => a.id).join(',')],
    queryFn: async () => {
      if (sharedAccounts.length === 0) return {};

      const result: Record<string, { income: number; expense: number }> = {};

      // Fetch all shared account transactions in one query
      const accountIds = sharedAccounts.map(a => a.id);
      const { data, error } = await supabase
        .from('transactions')
        .select('type, amount, account_id')
        .in('account_id', accountIds);
      if (error) throw error;

      for (const tx of data) {
        const accId = tx.account_id!;
        if (!result[accId]) result[accId] = { income: 0, expense: 0 };
        const amt = Number(tx.amount);
        if (tx.type === 'income') result[accId].income += amt;
        else result[accId].expense += amt;
      }

      return result;
    },
    enabled: !!user && sharedAccounts.length > 0,
  });

  const hasMultipleOwn = ownAccounts.length > 1;
  const hasShared = sharedAccounts.length > 0;

  if (!personalBalance || (!hasMultipleOwn && !hasShared)) return null;

  return (
    <Card className="mb-6 border-border/50 bg-gradient-to-r from-primary/5 to-accent/5">
      <CardContent className="p-5">
        {/* Global personal balance */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Layers className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">{t('dashboard.global_summary')}</h3>
        </div>

        <div className="mb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{t('dashboard.global_balance')}</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {discreet ? '••••••' : <><AnimatedNumber value={personalBalance.totalBalance} /> <span className="text-base font-normal text-muted-foreground">Ar</span></>}
          </p>
        </div>

        {/* Personal accounts */}
        {hasMultipleOwn && (
          <>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t('dashboard.my_accounts')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
              {ownAccounts.map((acc) => {
                const accData = personalBalance.byAccount[acc.id] || { income: 0, expense: 0 };
                const accBalance = accData.income - accData.expense;
                return (
                  <div key={acc.id} className="flex items-center gap-2 rounded-lg bg-card p-3 border border-border/30">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: acc.color + '20', color: acc.color }}
                    >
                      <Wallet className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{acc.name}</p>
                      <p className="text-sm font-semibold text-foreground">{discreet ? '••••••' : `${accBalance.toLocaleString()} Ar`}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Shared accounts */}
        {hasShared && (
          <>
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('dashboard.shared_accounts')}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {sharedAccounts.map((acc) => {
                const accData = sharedBalances?.[acc.id] || { income: 0, expense: 0 };
                const accBalance = accData.income - accData.expense;
                return (
                  <div key={acc.id} className="flex items-center gap-2 rounded-lg bg-card p-3 border border-border/30 border-dashed">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: acc.color + '20', color: acc.color }}
                    >
                      <Users className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{acc.name}</p>
                      <p className="text-[10px] text-muted-foreground/70 truncate">{acc.owner_name}</p>
                      <p className="text-sm font-semibold text-foreground">{discreet ? '••••••' : `${accBalance.toLocaleString()} Ar`}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default GlobalBalanceSummary;
