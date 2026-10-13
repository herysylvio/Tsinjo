import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingDown, TrendingUp, Sparkles, ArrowRightLeft, Eye, EyeOff } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTransactions } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';
import TransactionItem from '@/components/TransactionItem';
import TransactionForm from '@/components/TransactionForm';
import TransferForm from '@/components/TransferForm';
import StatsCards from '@/components/StatsCards';
import GlobalBalanceSummary from '@/components/GlobalBalanceSummary';
import RevenueChart, { type ChartPeriod } from '@/components/RevenueChart';
import ExpenseChart from '@/components/ExpenseChart';
import PersonalBudgets from '@/components/PersonalBudgets';
import FinancialHealthScore from '@/components/FinancialHealthScore';
import AchievementBadges from '@/components/AchievementBadges';
import { useDailyTip } from '@/hooks/useDailyTip';
import { Skeleton } from '@/components/ui/skeleton';
import type { Transaction, TransactionType } from '@/hooks/useTransactions';

const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<TransactionType>('expense');
  const [transferOpen, setTransferOpen] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('month');
  const [discreetMode, setDiscreetMode] = useState(() => localStorage.getItem('discreet_mode') === 'true');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const handleEdit = useCallback((tx: Transaction) => {
    setEditingTx(tx);
    setFormType(tx.type as TransactionType);
    setFormOpen(true);
  }, []);

  const toggleDiscreet = () => {
    setDiscreetMode(prev => {
      const next = !prev;
      localStorage.setItem('discreet_mode', String(next));
      return next;
    });
  };

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { tip, isLoading: tipLoading } = useDailyTip();
  const { activeAccountId, accounts, activeAccount } = useAccounts();
  const isSharedAccount = activeAccount?.shared === true;
  const isViewer = isSharedAccount && activeAccount?.sharedRole === 'viewer';
  const { transactions, balance } = useTransactions({ accountId: activeAccountId });
  const recentTransactions = transactions.slice(0, 5);

  const openForm = (type: TransactionType) => {
    setFormType(type);
    setFormOpen(true);
  };

  return (
    <div className="animate-fade-in p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">
            {t('dashboard.greeting')}, {profile?.display_name || '👋'}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleDiscreet}
            className="gap-1.5"
            title={t('dashboard.discreet_mode')}
          >
            {discreetMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <p className="text-sm text-muted-foreground">{t('dashboard.overview_subtitle')}</p>
          <div className="ml-auto flex gap-2">
            {accounts.length > 1 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTransferOpen(true)}
                className="gap-1.5 bg-warning text-warning-foreground hover:bg-warning/90"
              >
                <ArrowRightLeft className="h-4 w-4" />
                <span className="text-xs sm:text-sm">{t('transfer.title')}</span>
              </Button>
            )}
            {!isViewer && (
              <>
                <Button
                  size="sm"
                  onClick={() => openForm('income')}
                  className="gap-1.5 bg-success text-success-foreground hover:bg-success/90"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs sm:text-sm">{t('dashboard.add_income')}</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => openForm('expense')}
                  className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <TrendingDown className="h-4 w-4" />
                  <span className="text-xs sm:text-sm">{t('dashboard.add_expense')}</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Global summary across all accounts */}
      <GlobalBalanceSummary discreet={discreetMode} />

      {/* KPI Stats (active account) */}
      <div className="mb-6">
        <StatsCards balance={balance.balance} income={balance.income} expense={balance.expense} discreet={discreetMode} />
      </div>

      {/* Chart period filter */}
      <div className="mb-3 flex gap-1">
        {(['day', 'week', 'month', 'year'] as ChartPeriod[]).map((p) => (
          <Button
            key={p}
            size="sm"
            variant={chartPeriod === p ? 'default' : 'outline'}
            className="text-xs h-7 px-3"
            onClick={() => setChartPeriod(p)}
          >
            {t(`dashboard.filter_${p}`)}
          </Button>
        ))}
      </div>

      {/* Charts row */}
      <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart transactions={transactions} period={chartPeriod} />
        </div>
        <div>
          <ExpenseChart transactions={transactions} period={chartPeriod} />
        </div>
      </div>

      {/* Financial Health Score + Budgets */}
      <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FinancialHealthScore />
        <PersonalBudgets />
      </div>

      {/* Achievement Badges */}
      <div className="mb-6">
        <AchievementBadges />
      </div>

      {/* AI Coach card */}
      <Card className="mb-6 border-0 bg-[hsl(var(--coach))] text-[hsl(var(--coach-foreground))]">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{t('dashboard.ai_coach_title')}</h3>
            {tipLoading ? (
              <Skeleton className="h-4 w-3/4 mt-1 bg-white/20" />
            ) : (
              <p className="text-sm opacity-90 mt-1">{tip || t('dashboard.ai_coach_tip')}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent transactions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {t('dashboard.recent_transactions')}
        </h2>
        {recentTransactions.length === 0 ? (
          <Card className="border-dashed border-border/50">
            <CardContent className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">{t('dashboard.no_transactions')}</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/50">
            <CardContent className="divide-y divide-border p-3">
              {recentTransactions.map((tx) => (
                <TransactionItem key={tx.id} transaction={tx} discreet={discreetMode} onEdit={isSharedAccount ? undefined : handleEdit} readOnly={isSharedAccount} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <TransactionForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingTx(null);
        }}
        defaultType={formType}
        editTransaction={editingTx}
      />
      <TransferForm open={transferOpen} onOpenChange={setTransferOpen} />
    </div>
  );
};

export default Dashboard;
