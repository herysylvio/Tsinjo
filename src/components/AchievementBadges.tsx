import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { useAchievements } from '@/hooks/useAchievements';

const AchievementBadges = () => {
  const { t } = useTranslation();
  const { achievements, streak } = useAchievements();

  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {t('achievements.title')}
          </h3>
          {streak >= 2 && (
            <span className="text-xs font-bold text-accent flex items-center gap-1">
              🔥 {streak} {t('achievements.streak_days')}
            </span>
          )}
        </div>

        <div className="flex gap-3 justify-center flex-wrap">
          {achievements.map((badge, i) => (
            <motion.div
              key={badge.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.1, type: 'spring', stiffness: 260, damping: 20 }}
              className="flex flex-col items-center gap-1"
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl transition-all ${
                  badge.unlocked
                    ? 'bg-primary/10 shadow-md'
                    : 'bg-muted/50 grayscale opacity-40'
                }`}
              >
                {badge.icon}
              </div>
              <span className="text-[10px] text-muted-foreground text-center max-w-[64px] leading-tight">
                {t(`achievements.${badge.id}`)}
              </span>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AchievementBadges;
