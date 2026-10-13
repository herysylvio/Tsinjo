import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, animate } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { useFinancialHealth, HealthLevel } from '@/hooks/useFinancialHealth';
import confetti from 'canvas-confetti';

const LEVEL_COLORS: Record<HealthLevel, string> = {
  critical: 'hsl(0, 72%, 51%)',
  fragile: 'hsl(25, 95%, 53%)',
  stable: 'hsl(48, 96%, 53%)',
  healthy: 'hsl(142, 71%, 45%)',
  excellent: 'hsl(152, 76%, 36%)',
};

const ARC_RADIUS = 70;
const ARC_STROKE = 10;
const ARC_LENGTH = Math.PI * ARC_RADIUS; // semicircle

const FinancialHealthScore = () => {
  const { t } = useTranslation();
  const health = useFinancialHealth();
  const [displayScore, setDisplayScore] = useState(0);
  const [dashOffset, setDashOffset] = useState(ARC_LENGTH);
  const [confettiFired, setConfettiFired] = useState(false);

  useEffect(() => {
    const targetOffset = ARC_LENGTH - (health.score / 100) * ARC_LENGTH;
    
    const scoreAnim = animate(0, health.score, {
      duration: 1.5,
      ease: [0.25, 0.46, 0.45, 0.94],
      onUpdate: (v) => setDisplayScore(Math.round(v)),
    });

    const arcAnim = animate(ARC_LENGTH, targetOffset, {
      duration: 1.5,
      ease: [0.25, 0.46, 0.45, 0.94],
      onUpdate: (v) => setDashOffset(v),
    });

    // Confetti for score > 80
    if (health.score >= 80 && !confettiFired) {
      const monthKey = `health_confetti_${new Date().getFullYear()}_${new Date().getMonth()}`;
      if (!localStorage.getItem(monthKey)) {
        setTimeout(() => {
          confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
          localStorage.setItem(monthKey, '1');
        }, 1600);
      }
      setConfettiFired(true);
    }

    return () => {
      scoreAnim.stop();
      arcAnim.stop();
    };
  }, [health.score]);

  const color = LEVEL_COLORS[health.level];

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          {t('health_score.title')}
        </h3>

        <div className="flex flex-col items-center">
          {/* SVG Arc Gauge */}
          <svg width="180" height="100" viewBox="0 0 180 100" className="overflow-visible">
            {/* Background arc */}
            <path
              d={`M 20 90 A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 160 90`}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth={ARC_STROKE}
              strokeLinecap="round"
            />
            {/* Score arc */}
            <path
              d={`M 20 90 A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 160 90`}
              fill="none"
              stroke={color}
              strokeWidth={ARC_STROKE}
              strokeLinecap="round"
              strokeDasharray={ARC_LENGTH}
              strokeDashoffset={dashOffset}
              style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
            />
            {/* Score text */}
            <text
              x="90"
              y="75"
              textAnchor="middle"
              className="fill-foreground"
              style={{ fontSize: '28px', fontWeight: 700 }}
            >
              {displayScore}
            </text>
            <text
              x="90"
              y="92"
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              {t(`health_score.${health.level}`)}
            </text>
          </svg>

          {/* Breakdown */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4 w-full max-w-xs">
            {[
              { label: t('health_score.savings_rate'), value: health.savingsRate },
              { label: t('health_score.budget_adherence'), value: health.budgetAdherence },
              { label: t('health_score.diversification'), value: health.diversification },
              { label: t('health_score.regularity'), value: health.incomeRegularity },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground truncate">{item.label}</span>
                <span className="text-xs font-semibold text-foreground">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FinancialHealthScore;
