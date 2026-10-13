import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Transaction } from '@/hooks/useTransactions';
import {
  startOfMonth, endOfMonth, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfYear, endOfYear,
  parseISO, isWithinInterval,
} from 'date-fns';
import type { ChartPeriod } from './RevenueChart';

const COLORS = [
  'hsl(145, 63%, 42%)',
  'hsl(0, 72%, 50%)',
  'hsl(36, 89%, 55%)',
  'hsl(220, 70%, 55%)',
  'hsl(280, 60%, 55%)',
  'hsl(30, 80%, 55%)',
  'hsl(180, 60%, 45%)',
];

interface ExpenseChartProps {
  transactions: Transaction[];
  period?: ChartPeriod;
}

const ExpenseChart = ({ transactions, period = 'month' }: ExpenseChartProps) => {
  const { t } = useTranslation();

  const chartData = useMemo(() => {
    const now = new Date();
    let interval: { start: Date; end: Date };

    switch (period) {
      case 'day':
        interval = { start: startOfDay(now), end: endOfDay(now) };
        break;
      case 'week':
        interval = { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
        break;
      case 'year':
        interval = { start: startOfYear(now), end: endOfYear(now) };
        break;
      default:
        interval = { start: startOfMonth(now), end: endOfMonth(now) };
    }

    const filtered = transactions.filter(
      (tx) => tx.type === 'expense' && isWithinInterval(parseISO(tx.transaction_date), interval)
    );

    const byCategory: Record<string, number> = {};
    filtered.forEach((tx) => {
      byCategory[tx.category] = (byCategory[tx.category] || 0) + Number(tx.amount);
    });

    return Object.entries(byCategory)
      .map(([category, value]) => ({
        name: t(`transactions.categories.${category}`),
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, t, period]);

  if (chartData.length === 0) {
    return (
      <Card className="border-border/50 h-full">
        <CardContent className="p-5 flex items-center justify-center h-full min-h-[300px]">
          <p className="text-sm text-muted-foreground">{t('dashboard.no_expense_data')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 h-full">
      <CardContent className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {t('dashboard.expense_chart_title')}
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => `${value.toLocaleString()} Ar`}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--card-foreground))',
                fontSize: '12px',
              }}
              itemStyle={{ color: 'hsl(var(--card-foreground))' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {chartData.map((entry, i) => (
            <div key={entry.name} className="flex items-center gap-1.5 text-xs">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-muted-foreground">{entry.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ExpenseChart;
