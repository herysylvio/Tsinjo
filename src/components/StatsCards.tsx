import { useTranslation } from 'react-i18next';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import AnimatedNumber from '@/components/AnimatedNumber';

interface StatsCardsProps {
  balance: number;
  income: number;
  expense: number;
  discreet?: boolean;
}

const StatsCards = ({ balance, income, expense, discreet }: StatsCardsProps) => {
  const { t } = useTranslation();

  const cards = [
    {
      label: t('dashboard.balance'),
      value: balance,
      icon: Wallet,
      iconBg: 'bg-primary/15 text-primary',
      prefix: '',
    },
    {
      label: t('dashboard.total_income'),
      value: income,
      icon: TrendingUp,
      iconBg: 'bg-success/15 text-success',
      prefix: '+',
    },
    {
      label: t('dashboard.total_expense'),
      value: expense,
      icon: TrendingDown,
      iconBg: 'bg-destructive/15 text-destructive',
      prefix: '-',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.4, ease: 'easeOut' }}
        >
          <Card className="border-border/50 transition-shadow hover:shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {card.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                    {discreet ? '••••••' : <><AnimatedNumber value={card.value} prefix={card.prefix} /> <span className="text-base font-normal text-muted-foreground">Ar</span></>}
                  </p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg}`}>
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

export default StatsCards;
