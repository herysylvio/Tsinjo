import { useMemo, useState, useCallback } from 'react';
import { usePersonalBudgets } from '@/hooks/usePersonalBudgets';
import { useTransactions } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';
import { useRecurringPending } from '@/hooks/useRecurringPending';

export interface BudgetAlert {
  id: string;
  category: string;
  spent: number;
  limit: number;
  severity: 'warning' | 'exceeded';
}

const getSeenKey = () => {
  const now = new Date();
  return `notifications-seen-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getSeenCategories = (): Set<string> => {
  try {
    const raw = localStorage.getItem(getSeenKey());
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

const saveSeenCategories = (categories: Set<string>) => {
  localStorage.setItem(getSeenKey(), JSON.stringify([...categories]));
};

export const useNotifications = () => {
  const { budgets } = usePersonalBudgets();
  const { activeAccountId } = useAccounts();
  const { transactions } = useTransactions({ accountId: activeAccountId });
  const [seenCategories, setSeenCategories] = useState<Set<string>>(getSeenCategories);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthlyExpenses = useMemo(() =>
    transactions
      .filter(tx => tx.type === 'expense' && tx.transaction_date.startsWith(currentMonth))
      .reduce((acc, tx) => {
        acc[tx.category] = (acc[tx.category] || 0) + Number(tx.amount);
        return acc;
      }, {} as Record<string, number>),
    [transactions, currentMonth]
  );

  const alerts: BudgetAlert[] = useMemo(() =>
    budgets
      .map(budget => {
        const spent = monthlyExpenses[budget.category] || 0;
        const pct = Number(budget.amount) > 0 ? (spent / Number(budget.amount)) * 100 : 0;
        if (pct >= 80) {
          return {
            id: budget.category,
            category: budget.category,
            spent,
            limit: Number(budget.amount),
            severity: pct > 100 ? 'exceeded' as const : 'warning' as const,
          };
        }
        return null;
      })
      .filter(Boolean) as BudgetAlert[],
    [budgets, monthlyExpenses]
  );

  const { pending, confirmPending, dismissPending, confirmAll } = useRecurringPending();

  const unseenCount = useMemo(
    () => alerts.filter(a => !seenCategories.has(a.id)).length + pending.length,
    [alerts, seenCategories, pending]
  );

  const markAllSeen = useCallback(() => {
    const newSeen = new Set([...seenCategories, ...alerts.map(a => a.id)]);
    setSeenCategories(newSeen);
    saveSeenCategories(newSeen);
  }, [alerts, seenCategories]);

  return { alerts, pending, unseenCount, markAllSeen, confirmPending, dismissPending, confirmAll };
};
