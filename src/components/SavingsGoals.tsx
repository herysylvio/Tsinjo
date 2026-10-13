import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, PiggyBank, TrendingUp } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useSavingsGoals } from '@/hooks/useSavingsGoals';
import { useAccounts } from '@/hooks/useAccounts';
import { toast } from '@/hooks/use-toast';

const GOAL_ICONS = ['🎯', '🏠', '🚗', '✈️', '📱', '🎓', '💍', '🏥', '💰'];
const GOAL_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const SavingsGoals = () => {
  const { t } = useTranslation();
  const { goals, createGoal, addAmount, deleteGoal } = useSavingsGoals();
  const { accounts, addAccount } = useAccounts();
  const [createOpen, setCreateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('🎯');
  const [selectedColor, setSelectedColor] = useState('#6366f1');
  const [deadline, setDeadline] = useState('');
  const [depositAmount, setDepositAmount] = useState('');

  // Find savings account (name contains "épargne" or "tahiry" or "savings", case-insensitive)
  const savingsAccount = accounts.find(a =>
    /[eé]pargne|tahiry|savings|saving/i.test(a.name)
  );

  const handleCreateSavingsAccount = async () => {
    try {
      await addAccount.mutateAsync({ name: 'Épargne', icon: 'piggy-bank', color: '#10b981' });
    } catch {
      toast({ title: t('transactions.error_generic'), variant: 'destructive' });
    }
  };

  const handleCreate = async () => {
    const target = parseFloat(targetAmount);
    if (!name.trim() || isNaN(target) || target <= 0 || !savingsAccount) return;
    try {
      await createGoal.mutateAsync({
        name: name.trim(),
        target_amount: target,
        icon: selectedIcon,
        color: selectedColor,
        deadline: deadline || undefined,
        account_id: savingsAccount.id,
      });
      setCreateOpen(false);
      resetForm();
      toast({ title: t('savings.created') });
    } catch {
      toast({ title: t('transactions.error_generic'), variant: 'destructive' });
    }
  };

  const handleDeposit = async (goalId: string) => {
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) return;
    try {
      await addAmount.mutateAsync({ id: goalId, amount: amt });
      
      // Check if goal just completed
      const goal = goals.find(g => g.id === goalId);
      if (goal && Number(goal.current_amount) + amt >= Number(goal.target_amount)) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
      
      setAddOpen(null);
      setDepositAmount('');
      toast({ title: t('savings.deposited') });
    } catch {
      toast({ title: t('transactions.error_generic'), variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGoal.mutateAsync(id);
      toast({ title: t('savings.deleted') });
    } catch {
      toast({ title: t('transactions.error_generic'), variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setName('');
    setTargetAmount('');
    setSelectedIcon('🎯');
    setSelectedColor('#6366f1');
    setDeadline('');
  };

  const totalSaved = goals.reduce((s, g) => s + Number(g.current_amount), 0);
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);

  // If no savings account, show prompt
  if (!savingsAccount) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {t('savings.title')}
        </h2>
        <Card className="border-dashed border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-10 space-y-4">
            <PiggyBank className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {t('savings.no_savings_account')}
            </p>
            <Button onClick={handleCreateSavingsAccount} disabled={addAccount.isPending} className="gap-2">
              <PiggyBank className="h-4 w-4" />
              {addAccount.isPending ? '...' : t('savings.create_savings_account')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {t('savings.title')}
        </h2>
        <span className="text-xs text-muted-foreground">
          {t('savings.savings_account_label')}: {savingsAccount.name}
        </span>
      </div>

      {/* Summary */}
      {goals.length > 0 && (
        <Card className="border-0 bg-primary/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{t('savings.total_saved')}</span>
              </div>
              <span className="text-sm font-bold">
                {totalSaved.toLocaleString()} / {totalTarget.toLocaleString()} Ar
              </span>
            </div>
            <Progress
              value={totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0}
              className="h-2"
            />
          </CardContent>
        </Card>
      )}

      {/* Goal items */}
      {goals.map((goal) => {
        const pct = Number(goal.target_amount) > 0
          ? (Number(goal.current_amount) / Number(goal.target_amount)) * 100
          : 0;
        const completed = pct >= 100;

        return (
          <Card key={goal.id} className="border-0">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{goal.icon}</span>
                  <div>
                    <span className="text-sm font-medium">{goal.name}</span>
                    {goal.deadline && (
                      <p className="text-[10px] text-muted-foreground">
                        {t('savings.deadline')}: {new Date(goal.deadline).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${completed ? 'text-success' : 'text-muted-foreground'}`}>
                    {Math.round(pct)}%
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(goal.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <Progress
                value={Math.min(pct, 100)}
                className="h-2"
                style={{ '--progress-color': goal.color } as React.CSSProperties}
              />

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {Number(goal.current_amount).toLocaleString()} / {Number(goal.target_amount).toLocaleString()} Ar
                </span>
                {!completed && (
                  <Dialog open={addOpen === goal.id} onOpenChange={(o) => setAddOpen(o ? goal.id : null)}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1 px-2">
                        <TrendingUp className="h-3 w-3" />
                        {t('savings.add_funds')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t('savings.add_funds')} – {goal.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <Input
                          type="number"
                          placeholder={t('savings.amount_placeholder')}
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleDeposit(goal.id)}
                        />
                        <Button onClick={() => handleDeposit(goal.id)} disabled={addAmount.isPending} className="w-full">
                          {addAmount.isPending ? '...' : t('transactions.save')}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                {completed && (
                  <span className="text-[11px] font-bold text-success">✅ {t('savings.completed')}</span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Empty state */}
      {goals.length === 0 && (
        <div className="text-center py-6">
          <PiggyBank className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">{t('savings.empty')}</p>
        </div>
      )}

      {/* Create goal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full gap-2">
            <Plus className="h-4 w-4" />
            {t('savings.add')}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('savings.add')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder={t('savings.name_placeholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              type="number"
              placeholder={t('savings.target_placeholder')}
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
            />
            <div>
              <p className="text-xs text-muted-foreground mb-2">{t('savings.choose_icon')}</p>
              <div className="flex gap-2 flex-wrap">
                {GOAL_ICONS.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setSelectedIcon(icon)}
                    className={`text-xl p-1.5 rounded-lg transition-all ${selectedIcon === icon ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-muted'}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">{t('savings.choose_color')}</p>
              <div className="flex gap-2 flex-wrap">
                {GOAL_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`h-7 w-7 rounded-full transition-all ${selectedColor === color ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              placeholder={t('savings.deadline_placeholder')}
            />
            <Button onClick={handleCreate} disabled={createGoal.isPending} className="w-full">
              {createGoal.isPending ? '...' : t('transactions.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SavingsGoals;
