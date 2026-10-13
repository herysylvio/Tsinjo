import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Delete, AlertCircle } from 'lucide-react';
import tsinjoLogo from '@/assets/tsinjo-logo.png';

interface LockScreenProps {
  onUnlock: (pin: string) => Promise<boolean>;
}

const PIN_LENGTH = 4;

const LockScreen = ({ onUnlock }: LockScreenProps) => {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDigit = (digit: string) => {
    if (pin.length >= PIN_LENGTH || loading) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError(false);

    if (newPin.length === PIN_LENGTH) {
      setLoading(true);
      onUnlock(newPin).then(success => {
        setLoading(false);
        if (!success) {
          setError(true);
          setPin('');
        }
      });
    }
  };

  const handleDelete = () => {
    if (loading) return;
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
    >
      <div className="flex flex-col items-center gap-6 w-full max-w-xs px-4">
        <img src={tsinjoLogo} alt="Tsinjo" className="h-16 w-16 rounded-2xl" />
        
        <div className="text-center">
          <Lock className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t('lock.title')}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t('lock.subtitle')}</p>
        </div>

        {/* PIN dots */}
        <div className="flex gap-3">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <motion.div
              key={i}
              animate={error ? { x: [0, -6, 6, -4, 4, 0] } : {}}
              transition={{ duration: 0.4 }}
              className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${
                i < pin.length
                  ? error
                    ? 'bg-destructive border-destructive'
                    : 'bg-primary border-primary'
                  : 'border-muted-foreground/30'
              }`}
            />
          ))}
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 text-sm text-destructive"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            {t('lock.wrong_pin')}
          </motion.div>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {digits.map((d, i) => {
            if (d === '') return <div key={i} />;
            if (d === 'del') {
              return (
                <button
                  key={i}
                  onClick={handleDelete}
                  className="flex h-14 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent active:scale-95 transition-all"
                >
                  <Delete className="h-5 w-5" />
                </button>
              );
            }
            return (
              <button
                key={i}
                onClick={() => handleDigit(d)}
                className="flex h-14 items-center justify-center rounded-xl bg-muted/50 text-xl font-semibold hover:bg-accent active:scale-95 transition-all"
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default LockScreen;
