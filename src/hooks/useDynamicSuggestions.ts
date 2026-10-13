import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTransactions } from '@/hooks/useTransactions';

const FALLBACK_FR = [
  "Analyse mes dépenses de ce mois",
  "Comment économiser sur la nourriture ?",
  "Quel budget mensuel me conseilles-tu ?",
  "Quelles sont mes plus grosses dépenses ?",
];

const FALLBACK_MG = [
  "Jereo ny fandaniako androany",
  "Ahoana no hitsitsiana amin'ny sakafo ?",
  "Ohatrinona no tokony ho tetibola isam-bolana ?",
  "Inona ny fandaniana lehibe indrindra ?",
];

const CATEGORY_LABELS_FR: Record<string, string> = {
  food: 'nourriture', transport: 'transport', health: 'santé',
  education: 'éducation', leisure: 'loisirs', housing: 'maison',
  salary: 'salaire', freelance: 'freelance', gift: 'cadeau',
  other_expense: 'autres dépenses', other_income: 'autres revenus',
};

const CATEGORY_LABELS_MG: Record<string, string> = {
  food: 'sakafo', transport: 'fitaterana', health: 'fahasalamana',
  education: 'fanabeazana', leisure: 'fialam-boly', housing: 'trano',
  salary: 'karama', freelance: 'freelance', gift: 'fanomezana',
  other_expense: 'fandaniana hafa', other_income: 'vola miditra hafa',
};

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount));
}

export const useDynamicSuggestions = (): string[] => {
  const { i18n } = useTranslation();
  const { transactions, balance } = useTransactions();
  const isMg = i18n.language === 'mg';
  const labels = isMg ? CATEGORY_LABELS_MG : CATEGORY_LABELS_FR;

  return useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return isMg ? FALLBACK_MG : FALLBACK_FR;
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonth = transactions.filter((t) => {
      const d = new Date(t.transaction_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const monthExpenses = thisMonth.filter((t) => t.type === 'expense');
    const monthIncomes = thisMonth.filter((t) => t.type === 'income');

    // Top expense category this month
    const catTotals: Record<string, number> = {};
    monthExpenses.forEach((t) => {
      catTotals[t.category] = (catTotals[t.category] || 0) + Number(t.amount);
    });
    const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

    const suggestions: string[] = [];

    // 1. Top category
    if (topCat) {
      const catLabel = labels[topCat[0]] || topCat[0];
      const amt = formatAmount(topCat[1]);
      suggestions.push(
        isMg
          ? `Nandany ${amt} Ar tamin'ny ${catLabel} aho tamin'ity volana ity, ahoana no hampihenana ?`
          : `J'ai dépensé ${amt} Ar en ${catLabel} ce mois, comment réduire ?`
      );
    }

    // 2. Balance
    if (balance.balance !== 0) {
      const amt = formatAmount(Math.abs(balance.balance));
      suggestions.push(
        isMg
          ? `Ny ambim-bolako dia ${amt} Ar, ohatrinona no tokony hotahiriziko ?`
          : `Mon solde est de ${amt} Ar, combien devrais-je épargner ?`
      );
    }

    // 3. No income this month
    if (monthIncomes.length === 0) {
      suggestions.push(
        isMg
          ? "Tsy mbola nisy vola niditra tamin'ity volana ity, inona no azo atao ?"
          : "Je n'ai pas encore de revenu ce mois, que me conseilles-tu ?"
      );
    } else {
      const totalIncome = formatAmount(monthIncomes.reduce((s, t) => s + Number(t.amount), 0));
      suggestions.push(
        isMg
          ? `Nahazo ${totalIncome} Ar aho tamin'ity volana ity, tsara ve ny fandaniana ?`
          : `J'ai gagné ${totalIncome} Ar ce mois, est-ce que mes dépenses sont raisonnables ?`
      );
    }

    // 4. Number of expense categories
    const catCount = Object.keys(catTotals).length;
    if (catCount >= 3) {
      suggestions.push(
        isMg
          ? `Misy sokajy ${catCount} ny fandaniako, iza no tokony hampiana ?`
          : `Mes dépenses couvrent ${catCount} catégories, lesquelles optimiser ?`
      );
    } else {
      suggestions.push(
        isMg
          ? "Omeo torohevitra momba ny fitantanana vola azafady"
          : "Donne-moi des conseils pour mieux gérer mes finances"
      );
    }

    return suggestions.slice(0, 4);
  }, [transactions, balance, isMg, labels]);
};
