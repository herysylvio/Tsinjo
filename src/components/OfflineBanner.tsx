import { WifiOff, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { motion, AnimatePresence } from 'framer-motion';

const OfflineBanner = () => {
  const { isOnline } = useNetworkStatus();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isOnline) setDismissed(false);
  }, [isOnline]);

  const visible = !isOnline && !dismissed;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-amber-500 text-white text-xs font-medium flex items-center gap-2 py-1 px-3 overflow-hidden"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 truncate whitespace-nowrap">
            Mode hors ligne — sync auto
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 rounded p-0.5 hover:bg-white/20 transition-colors"
            aria-label="Fermer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineBanner;
