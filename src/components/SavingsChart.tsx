import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

interface Deposit {
  id: string;
  savings_goal_id: string;
  amount: number;
  created_at: string;
}

interface SavingsGoal {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface SavingsChartProps {
  deposits: Deposit[];
  goals: SavingsGoal[];
}

const SavingsChart = ({ deposits, goals }: SavingsChartProps) => {
  const { t } = useTranslation();

  const chartData = useMemo(() => {
    if (!deposits.length) return [];

    const sorted = [...deposits].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    let cumulative = 0;
    const data = sorted.map((d) => {
      cumulative += Number(d.amount);
      const goal = goals.find((g) => g.id === d.savings_goal_id);
      return {
        date: new Date(d.created_at).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'short',
        }),
        amount: Number(d.amount),
        cumulative,
        goalName: goal?.name ?? '',
        goalIcon: goal?.icon ?? '',
      };
    });

    return data;
  }, [deposits, goals]);

  if (!chartData.length) {
    return null;
  }

  return (
    <Card className="border-0">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{t('savings.chart_title')}</span>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-background p-2 text-xs shadow-lg">
                      <p className="font-medium">{d.date}</p>
                      <p className="text-muted-foreground">
                        {d.goalIcon} {d.goalName}
                      </p>
                      <p className="text-primary font-bold">
                        +{Number(d.amount).toLocaleString()} Ar
                      </p>
                      <p className="text-foreground">
                        {t('savings.cumulative')}: {Number(d.cumulative).toLocaleString()} Ar
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#savingsGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Recent deposits list */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t('savings.recent_deposits')}</p>
          {deposits
            .slice()
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5)
            .map((d) => {
              const goal = goals.find((g) => g.id === d.savings_goal_id);
              return (
                <div key={d.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span>{goal?.icon ?? '💰'}</span>
                    <span className="text-muted-foreground">{goal?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-primary">
                      +{Number(d.amount).toLocaleString()} Ar
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
};

export default SavingsChart;
