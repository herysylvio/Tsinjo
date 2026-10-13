import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import BottomNav from './BottomNav';
import { AccountSwitcher } from './AccountSwitcher';
import NotificationBell from './NotificationBell';
import LockScreen from './LockScreen';
import OfflineBanner from './OfflineBanner';
import { useAutoLogout } from '@/hooks/useAutoLogout';
import { useAppLock } from '@/hooks/useAppLock';
import { useTheme } from '@/hooks/useTheme';
import { useOfflineSync } from '@/hooks/useOfflineSync';

const AppLayout = ({ children }: { children: ReactNode }) => {
  useTheme();
  useOfflineSync(); // Process sync queue when back online
  const { isLocked, hasPinSet, lock, unlock } = useAppLock();
  useAutoLogout(hasPinSet ? lock : null);
  const location = useLocation();
  const navigate = useNavigate();
  const isChatPage = location.pathname === '/chat';

  if (isLocked) {
    return <LockScreen onUnlock={unlock} />;
  }

  return (
    <SidebarProvider>
      <OfflineBanner />
      <div className="min-h-screen flex w-full bg-background">
        {/* Desktop sidebar */}
        <div className="hidden md:flex">
          <AppSidebar />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Desktop header with sidebar trigger */}
          <header className="hidden md:flex h-14 items-center justify-between border-b border-border px-4">
            <SidebarTrigger className="text-muted-foreground" />
            <NotificationBell />
          </header>

          {/* Mobile header with account switcher */}
          <header className="md:hidden flex h-12 items-center justify-between border-b border-border px-3">
            <AccountSwitcher collapsed={false} />
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigate('/settings')}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label="Paramètres"
              >
                <Settings className="h-4.5 w-4.5" />
              </button>
              <NotificationBell />
            </div>
          </header>

          <main className="flex-1 pb-20 md:pb-0">
            {children}
          </main>
        </div>

        {/* Mobile bottom nav */}
        <div className="md:hidden">
          <BottomNav />
        </div>

        {/* Floating Chat AI button on mobile (hidden on chat page) */}
        <AnimatePresence>
          {!isChatPage && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              onClick={() => navigate('/chat')}
              className="md:hidden fixed right-4 bottom-20 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-95 transition-colors"
              aria-label="Chat IA"
            >
              <MessageCircle className="h-5 w-5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
