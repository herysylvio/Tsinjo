import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Transaction } from '@/hooks/useTransactions';
import {
  format, parseISO, subMonths, subWeeks, subDays, subYears,
  startOfMonth, endOfMonth, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfYear, endOfYear,
  eachMonthOfInterval, eachDayOfInterval, eachWeekOfInterval, eachYearOfInterval,
} from 'date-fns';
import { fr } from 'date-fns/locale';

export type ChartPeriod = 'day' | 'week' | 'month' | 'year';

interface RevenueChartProps {
  transactions: Transaction[];
  period?: ChartPeriod;
}

const RevenueChart = ({ transactions, period = 'month' }: RevenueChartProps) => {
  const { t } = useTranslation();

  const chartData = useMemo(() => {
    const now = new Date();

    if (period === 'day') {
      const days = eachDayOfInterval({ start: subDays(now, 6), end: now });
      return days.map((day) => {
        const start = startOfDay(day);
        const end = endOfDay(day);
        let income = 0, expense = 0;
        transactions.forEach((tx) => {
          const d = parseISO(tx.transaction_date);
          if (d >= start && d <= end) {
            if (tx.type === 'income') income += Number(tx.amount);
            else expense += Number(tx.amount);
          }
        });
        return {
          label: format(day, 'EEE dd', { locale: fr }),
          [t('dashboard.income_label')]: income,
          [t('dashboard.expense_label')]: expense,
        };
      });
    }

    if (period === 'week') {
      const weeks = eachWeekOfInterval(
        { start: subWeeks(now, 7), end: now },
        { weekStartsOn: 1 }
      );
      return weeks.map((week) => {
        const start = startOfWeek(week, { weekStartsOn: 1 });
        const end = endOfWeek(week, { weekStartsOn: 1 });
        let income = 0, expense = 0;
        transactions.forEach((tx) => {
          const d = parseISO(tx.transaction_date);
          if (d >= start && d <= end) {
            if (tx.type === 'income') income += Number(tx.amount);
            else expense += Number(tx.amount);
          }
        });
        return {
          label: format(start, 'dd MMM', { locale: fr }),
          [t('dashboard.income_label')]: income,
          [t('dashboard.expense_label')]: expense,
        };
      });
    }

    if (period === 'year') {
      const years = eachYearOfInterval({ start: subYears(now, 3), end: now });
      return years.map((year) => {
        const start = startOfYear(year);
        const end = endOfYear(year);
        let income = 0, expense = 0;
        transactions.forEach((tx) => {
          const d = parseISO(tx.transaction_date);
          if (d >= start && d <= end) {
            if (tx.type === 'income') income += Number(tx.amount);
            else expense += Number(tx.amount);
          }
        });
        return {
          label: format(year, 'yyyy'),
          [t('dashboard.income_label')]: income,
          [t('dashboard.expense_label')]: expense,
        };
      });
    }

    // month (default)
    const months = eachMonthOfInterval({
      start: startOfMonth(subMonths(now, 5)),
      end: endOfMonth(now),
    });
    return months.map((month) => {
      const start = startOfMonth(month);
      const end = endOfMonth(month);
      let income = 0, expense = 0;
      transactions.forEach((tx) => {
        const d = parseISO(tx.transaction_date);
        if (d >= start && d <= end) {
          if (tx.type === 'income') income += Number(tx.amount);
          else expense += Number(tx.amount);
        }
      });
      return {
        label: format(month, 'MMM', { locale: fr }),
        [t('dashboard.income_label')]: income,
        [t('dashboard.expense_label')]: expense,
      };
    });
  }, [transactions, t, period]);

  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {t('dashboard.revenue_chart_title')}
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(145, 63%, 42%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(145, 63%, 42%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(0, 72%, 50%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(0, 72%, 50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(160, 10%, 15%)" />
            <XAxis
              dataKey="label"
              tick={{ fill: 'hsl(150, 8%, 50%)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'hsl(150, 8%, 50%)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--card-foreground))',
                fontSize: '12px',
              }}
              itemStyle={{ color: 'hsl(var(--card-foreground))' }}
              formatter={(value: number) => `${value.toLocaleString()} Ar`}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', color: 'hsl(150, 8%, 50%)' }}
            />
            <Area
              type="monotone"
              dataKey={t('dashboard.income_label')}
              stroke="hsl(145, 63%, 42%)"
              strokeWidth={2}
              fill="url(#incomeGrad)"
            />
            <Area
              type="monotone"
              dataKey={t('dashboard.expense_label')}
              stroke="hsl(0, 72%, 50%)"
              strokeWidth={2}
              fill="url(#expenseGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default RevenueChart;
