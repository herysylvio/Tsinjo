import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, AlertTriangle, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { usePersonalBudgets } from '@/hooks/usePersonalBudgets';
import { useTransactions, EXPENSE_CATEGORIES } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';
import { toast } from '@/hooks/use-toast';

const PersonalBudgets = () => {
  const { t } = useTranslation();
  const { budgets, upsertBudget, deleteBudget } = usePersonalBudgets();
  const { activeAccountId } = useAccounts();
  const { transactions } = useTransactions({ accountId: activeAccountId });
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');

  // Current month expenses by category
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthlyExpenses = transactions
    .filter(tx => tx.type === 'expense' && tx.transaction_date.startsWith(currentMonth))
    .reduce((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + Number(tx.amount);
      return acc;
    }, {} as Record<string, number>);

  const budgetedCategories = new Set(budgets.map(b => b.category));
  const availableCategories = [...EXPENSE_CATEGORIES].filter(c => !budgetedCategories.has(c));

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!category || isNaN(amt) || amt <= 0) return;
    try {
      await upsertBudget.mutateAsync({ category, amount: amt });
      setOpen(false);
      setCategory('');
      setAmount('');
      toast({ title: t('budget.saved') });
    } catch {
      toast({ title: t('transactions.error_generic'), variant: 'destructive' });
    }
  };

  const handleDelete = async (budgetId: string) => {
    try {
      await deleteBudget.mutateAsync(budgetId);
      toast({ title: t('budget.deleted') });
    } catch {
      toast({ title: t('transactions.error_generic'), variant: 'destructive' });
    }
  };

  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = budgets.reduce((s, b) => s + (monthlyExpenses[b.category] || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {t('budget.title')}
        </h2>
      </div>

      {/* Summary */}
      {budgets.length > 0 && (
        <Card className="border-0 bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{t('budget.total')}</span>
              <span className="text-sm font-bold">
                {totalSpent.toLocaleString()} / {totalBudget.toLocaleString()} Ar
              </span>
            </div>
            <Progress
              value={totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0}
              className="h-2"
            />
            {totalSpent > totalBudget && (
              <div className="flex items-center gap-1.5 mt-2 text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">{t('budget.exceeded_total')}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Budget items */}
      {budgets.map((budget) => {
        const spent = monthlyExpenses[budget.category] || 0;
        const pct = Number(budget.amount) > 0 ? (spent / Number(budget.amount)) * 100 : 0;
        const exceeded = pct > 100;
        const warning = pct >= 80 && pct <= 100;

        return (
          <Card key={budget.id} className="border-0">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    {t(`transactions.categories.${budget.category}`, budget.category)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${exceeded ? 'text-destructive' : warning ? 'text-orange-500' : 'text-muted-foreground'}`}>
                    {spent.toLocaleString()} / {Number(budget.amount).toLocaleString()} Ar
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(budget.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <Progress
                value={Math.min(pct, 100)}
                className={`h-1.5 ${exceeded ? '[&>div]:bg-destructive' : warning ? '[&>div]:bg-orange-500' : ''}`}
              />
              {exceeded && (
                <div className="flex items-center gap-1.5 text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="text-[11px] font-medium">
                    {t('budget.exceeded', { amount: (spent - Number(budget.amount)).toLocaleString() })}
                  </span>
                </div>
              )}
              {warning && !exceeded && (
                <div className="flex items-center gap-1.5 text-orange-500">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="text-[11px] font-medium">{t('budget.warning')}</span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Empty state */}
      {budgets.length === 0 && (
        <div className="text-center py-6">
          <Target className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">{t('budget.empty')}</p>
        </div>
      )}

      {/* Add budget */}
      {availableCategories.length > 0 && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full gap-2">
              <Plus className="h-4 w-4" />
              {t('budget.add')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('budget.add')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder={t('transactions.select_category')} />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {t(`transactions.categories.${cat}`, cat)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder={t('budget.amount_placeholder')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              <Button onClick={handleSave} disabled={upsertBudget.isPending} className="w-full">
                {upsertBudget.isPending ? '...' : t('transactions.save')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default PersonalBudgets;
