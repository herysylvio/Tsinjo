import { useMemo } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { usePersonalBudgets } from '@/hooks/usePersonalBudgets';
import { useSavingsGoals } from '@/hooks/useSavingsGoals';
import { useAccounts } from '@/hooks/useAccounts';

export type HealthLevel = 'critical' | 'fragile' | 'stable' | 'healthy' | 'excellent';

export interface FinancialHealth {
  score: number;
  level: HealthLevel;
  savingsRate: number;
  budgetAdherence: number;
  diversification: number;
  incomeRegularity: number;
}

export const useFinancialHealth = (): FinancialHealth => {
  const { activeAccountId } = useAccounts();
  const { transactions, balance } = useTransactions({ accountId: activeAccountId });
  const { budgets } = usePersonalBudgets();
  const { goals } = useSavingsGoals();

  return useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthTx = transactions.filter(
      (tx) => new Date(tx.transaction_date) >= monthStart
    );

    const income = monthTx
      .filter((tx) => tx.type === 'income')
      .reduce((s, tx) => s + Number(tx.amount), 0);
    const expense = monthTx
      .filter((tx) => tx.type === 'expense')
      .reduce((s, tx) => s + Number(tx.amount), 0);

    // 1. Savings rate (40%)
    const savingsRate = income > 0 ? Math.max(0, Math.min(1, (income - expense) / income)) : 0;
    const savingsScore = savingsRate * 100;

    // 2. Budget adherence (30%)
    let budgetAdherence = 100;
    if (budgets.length > 0) {
      const expensesByCategory: Record<string, number> = {};
      monthTx
        .filter((tx) => tx.type === 'expense')
        .forEach((tx) => {
          expensesByCategory[tx.category] = (expensesByCategory[tx.category] || 0) + Number(tx.amount);
        });
      const adherent = budgets.filter((b) => {
        const spent = expensesByCategory[b.category] || 0;
        return spent <= b.amount;
      }).length;
      budgetAdherence = (adherent / budgets.length) * 100;
    }

    // 3. Category diversification (15%)
    const expenseCategories = new Set(
      monthTx.filter((tx) => tx.type === 'expense').map((tx) => tx.category)
    );
    const diversification = Math.min(expenseCategories.size / 4, 1) * 100;

    // 4. Income regularity (15%) — based on having income this month + savings goals progress
    let incomeRegularity = income > 0 ? 50 : 0;
    if (goals.length > 0) {
      const goalsWithProgress = goals.filter(
        (g) => Number(g.current_amount) > 0
      ).length;
      incomeRegularity += (goalsWithProgress / goals.length) * 50;
    } else if (income > 0) {
      incomeRegularity = 70;
    }

    const score = Math.round(
      savingsScore * 0.4 +
      budgetAdherence * 0.3 +
      diversification * 0.15 +
      incomeRegularity * 0.15
    );

    const clampedScore = Math.max(0, Math.min(100, score));

    let level: HealthLevel;
    if (clampedScore < 20) level = 'critical';
    else if (clampedScore < 40) level = 'fragile';
    else if (clampedScore < 60) level = 'stable';
    else if (clampedScore < 80) level = 'healthy';
    else level = 'excellent';

    return {
      score: clampedScore,
      level,
      savingsRate: Math.round(savingsRate * 100),
      budgetAdherence: Math.round(budgetAdherence),
      diversification: Math.round(diversification),
      incomeRegularity: Math.round(incomeRegularity),
    };
  }, [transactions, budgets, goals]);
};
