import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ArrowLeftRight, Target, PiggyBank, Crown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useSubscription } from '@/hooks/useSubscription';

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isPremium } = useSubscription();

  const tabs = [
    { path: '/', icon: Home, label: t('nav.home') },
    { path: '/transactions', icon: ArrowLeftRight, label: t('nav.transactions') },
    { path: '/budgets', icon: Target, label: t('nav.budgets') },
    { path: '/savings', icon: PiggyBank, label: t('nav.savings') },
    { path: '/premium', icon: Crown, label: 'Premium' },
    
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md safe-area-bottom">
      <div className="flex items-center justify-around px-1 py-1">
        {tabs.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          const isPremiumTab = path === '/premium';
          const showGlow = isPremiumTab && !isPremium && !isActive;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex min-h-[48px] min-w-[40px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 transition-colors ${
                isActive
                  ? 'text-primary'
                  : showGlow
                    ? 'text-amber-500 animate-glow-pulse'
                    : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <motion.div
                animate={isActive ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 1.8} />
              </motion.div>
              <span className="text-[10px] font-medium leading-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
