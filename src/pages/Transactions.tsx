import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, TrendingDown, TrendingUp, Repeat, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { exportCSV, exportPDF } from '@/lib/exportTransactions';
import { useTransactions, Transaction, TransactionType } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';
import TransactionItem from '@/components/TransactionItem';
import TransactionForm from '@/components/TransactionForm';
import RecurringTransactions from '@/components/RecurringTransactions';
import StatsCards from '@/components/StatsCards';
import { format, parseISO, startOfWeek, startOfMonth, startOfQuarter, isAfter } from 'date-fns';
import { fr } from 'date-fns/locale';

type PeriodFilter = 'all' | 'week' | 'month' | 'quarter';

const Transactions = () => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<TransactionType | 'all'>('all');
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [defaultType, setDefaultType] = useState<TransactionType>('expense');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [recurringOpen, setRecurringOpen] = useState(false);

  const openForm = (type: TransactionType) => {
    setDefaultType(type);
    setEditingTx(null);
    setFormOpen(true);
  };

  const handleEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditingTx(null);
  };

  const { activeAccountId, activeAccount } = useAccounts();
  const isSharedAccount = activeAccount?.shared === true;
  const isViewer = isSharedAccount && activeAccount?.sharedRole === 'viewer';
  const { transactions, balance, isLoading } = useTransactions(
    { type: filter === 'all' ? undefined : filter, accountId: activeAccountId }
  );

  const filteredTransactions = transactions.filter((tx) => {
    if (period === 'all') return true;
    const txDate = parseISO(tx.transaction_date);
    const now = new Date();
    const start =
      period === 'week' ? startOfWeek(now, { weekStartsOn: 1 }) :
      period === 'month' ? startOfMonth(now) :
      startOfQuarter(now);
    return isAfter(txDate, start) || txDate.getTime() === start.getTime();
  });

  const grouped = filteredTransactions.reduce<Record<string, typeof filteredTransactions>>((acc, tx) => {
    const key = tx.transaction_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(tx);
    return acc;
  }, {});

  return (
    <div className="animate-fade-in p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">{t('transactions.title')}</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={filteredTransactions.length === 0}>
                <Download className="h-4 w-4" />
                <span className="text-xs sm:text-sm">{t('export.title')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportCSV(filteredTransactions)}>
                {t('export.csv')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportPDF(filteredTransactions, { type: filter, period })}>
                {t('export.pdf')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setRecurringOpen(true)} className="gap-1.5">
            <Repeat className="h-4 w-4" />
            <span className="text-xs sm:text-sm">{t('recurring.button')}</span>
          </Button>
          {!isViewer && (
            <div className="ml-auto flex gap-2">
              <Button size="sm" onClick={() => openForm('expense')} className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90">
                <TrendingDown className="h-4 w-4" />
                <span className="text-xs sm:text-sm">{t('transactions.expense')}</span>
              </Button>
              <Button size="sm" onClick={() => openForm('income')} className="gap-1.5 bg-success text-success-foreground hover:bg-success/90">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs sm:text-sm">{t('transactions.income')}</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Stats on desktop */}
      <div className="mb-6 hidden md:block">
        <StatsCards balance={balance.balance} income={balance.income} expense={balance.expense} />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="flex-1">
          <TabsList className="w-full bg-muted">
            <TabsTrigger value="all" className="flex-1">{t('transactions.filter_all')}</TabsTrigger>
            <TabsTrigger value="expense" className="flex-1">{t('transactions.filter_expenses')}</TabsTrigger>
            <TabsTrigger value="income" className="flex-1">{t('transactions.filter_income')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('transactions.period_all')}</SelectItem>
            <SelectItem value="week">{t('transactions.period_week')}</SelectItem>
            <SelectItem value="month">{t('transactions.period_month')}</SelectItem>
            <SelectItem value="quarter">{t('transactions.period_quarter')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Transaction list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filteredTransactions.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">{t('transactions.no_transactions')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([date, txs]) => (
            <div key={date}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {format(parseISO(date), 'd MMMM yyyy', { locale: fr })}
              </p>
              <Card className="border-border/50">
                <CardContent className="divide-y divide-border p-3">
                  {txs.map((tx) => (
                    <TransactionItem key={tx.id} transaction={tx} onEdit={isSharedAccount ? undefined : handleEdit} readOnly={isSharedAccount} />
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      <TransactionForm open={formOpen} onOpenChange={handleFormClose} editTransaction={editingTx} defaultType={defaultType} />
      <RecurringTransactions open={recurringOpen} onOpenChange={setRecurringOpen} />
    </div>
  );
};

export default Transactions;
