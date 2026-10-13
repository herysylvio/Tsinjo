import { useEffect, useMemo, useCallback } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useSavingsGoals } from '@/hooks/useSavingsGoals';
import { useFamily } from '@/hooks/useFamily';
import { useFinancialHealth } from '@/hooks/useFinancialHealth';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';

export interface Achievement {
  id: string;
  icon: string;
  unlocked: boolean;
}

const STORAGE_KEY = 'tsinjo_achievements';
const STREAK_KEY = 'tsinjo_streak';

const getUnlocked = (): Record<string, boolean> => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

const markUnlocked = (id: string) => {
  const current = getUnlocked();
  current[id] = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
};

// Track daily app opens for streak
const updateStreak = (): number => {
  const today = new Date().toDateString();
  try {
    const data = JSON.parse(localStorage.getItem(STREAK_KEY) || '{}');
    if (data.lastDate === today) return data.count || 0;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (data.lastDate === yesterday.toDateString()) {
      const newCount = (data.count || 0) + 1;
      localStorage.setItem(STREAK_KEY, JSON.stringify({ lastDate: today, count: newCount }));
      return newCount;
    }
    
    localStorage.setItem(STREAK_KEY, JSON.stringify({ lastDate: today, count: 1 }));
    return 1;
  } catch {
    localStorage.setItem(STREAK_KEY, JSON.stringify({ lastDate: today, count: 1 }));
    return 1;
  }
};

export const useAchievements = () => {
  const { t } = useTranslation();
  const { transactions } = useTransactions();
  const { goals } = useSavingsGoals();
  const { family } = useFamily();
  const health = useFinancialHealth();

  const streak = useMemo(() => updateStreak(), []);

  const achievements = useMemo((): Achievement[] => {
    const unlocked = getUnlocked();
    
    const hasFirstTransaction = transactions.length > 0;
    const hasHealthy = health.score >= 80;
    const hasStreak = streak >= 7;
    const hasFamily = !!family;
    const hasGoalCompleted = goals.some(
      (g) => Number(g.current_amount) >= Number(g.target_amount) && Number(g.target_amount) > 0
    );

    return [
      { id: 'first_step', icon: '👣', unlocked: unlocked['first_step'] || hasFirstTransaction },
      { id: 'saver', icon: '💪', unlocked: unlocked['saver'] || hasHealthy },
      { id: 'regular', icon: '🔥', unlocked: unlocked['regular'] || hasStreak },
      { id: 'family_united', icon: '👨‍👩‍👧‍👦', unlocked: unlocked['family_united'] || hasFamily },
      { id: 'goal_reached', icon: '🏆', unlocked: unlocked['goal_reached'] || hasGoalCompleted },
    ];
  }, [transactions.length, health.score, streak, family, goals]);

  // Fire confetti + toast for newly unlocked badges
  useEffect(() => {
    const unlocked = getUnlocked();
    achievements.forEach((badge) => {
      if (badge.unlocked && !unlocked[badge.id]) {
        markUnlocked(badge.id);
        confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
        toast({
          title: `🎉 ${t('achievements.unlocked')}`,
          description: t(`achievements.${badge.id}`),
        });
      }
    });
  }, [achievements, t]);

  return { achievements, streak };
};
