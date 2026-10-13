import { useState } from 'react';
import tsinjoLogo from '@/assets/tsinjo-logo.png';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Globe, User, Users, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';

const steps = ['language', 'name', 'family'] as const;

const Onboarding = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: profileCheck, isLoading: checkingProfile } = useQuery({
    queryKey: ['profile-onboarding-guard', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('user_id', user!.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState(i18n.language);
  const [displayName, setDisplayName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLanguageChange = (lng: string) => {
    setLanguage(lng);
    i18n.changeLanguage(lng);
  };

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);

    // Update profile
    await supabase
      .from('profiles')
      .update({
        display_name: displayName,
        preferred_language: language,
        onboarding_completed: true,
      })
      .eq('user_id', user.id);

    // Insert initial balance transaction on default account
    const balanceAmount = parseFloat(initialBalance) || 0;
    if (balanceAmount > 0) {
      const { data: defaultAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .single();

      if (defaultAccount) {
        await supabase.from('transactions').insert({
          user_id: user.id,
          account_id: defaultAccount.id,
          type: 'income' as const,
          category: 'solde_initial',
          description: 'Solde de départ',
          amount: balanceAmount,
        });
      }
    }

    // Create family if name provided
    if (familyName.trim()) {
      const { data: family } = await supabase
        .from('families')
        .insert({ name: familyName, created_by: user.id })
        .select()
        .single();

      if (family) {
        await supabase
          .from('family_members')
          .insert({ family_id: family.id, user_id: user.id, role: 'admin' });
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['profile-onboarding'] });

    setLoading(false);
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    setTimeout(() => navigate('/', { replace: true }), 800);
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
  };

  const [direction, setDirection] = useState(1);

  const goNext = () => {
    setDirection(1);
    if (step < steps.length - 1) setStep(step + 1);
    else handleFinish();
  };

  const goBack = () => {
    setDirection(-1);
    if (step > 0) setStep(step - 1);
  };

  if (checkingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (profileCheck?.onboarding_completed) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-4 flex justify-center">
          <img src={tsinjoLogo} alt="Tsinjo" className="h-16 w-16 rounded-2xl animate-scale-in" />
        </div>
        {/* Progress dots */}
        <div className="mb-6 flex justify-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === step ? 'w-8 bg-primary' : 'w-2 bg-muted'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                {step === 0 && (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <Globe className="h-10 w-10 text-primary" />
                      <h2 className="text-xl font-bold">{t('onboarding.step_language')}</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { code: 'fr', label: t('settings.french'), flag: '🇫🇷' },
                        { code: 'mg', label: t('settings.malagasy'), flag: '🇲🇬' },
                      ].map(({ code, label, flag }) => (
                        <button
                          key={code}
                          onClick={() => handleLanguageChange(code)}
                          className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                            language === code
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/30'
                          }`}
                        >
                          <span className="text-2xl">{flag}</span>
                          <span className="text-sm font-medium">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <User className="h-10 w-10 text-secondary" />
                      <h2 className="text-xl font-bold">{t('onboarding.step_name')}</h2>
                    </div>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={t('onboarding.name_placeholder')}
                      className="text-center text-lg"
                      autoFocus
                    />
                    <div className="space-y-1">
                      <label className="text-sm text-muted-foreground">{t('accounts.initial_balance')}</label>
                      <Input
                        type="number"
                        min="0"
                        value={initialBalance}
                        onChange={(e) => setInitialBalance(e.target.value)}
                        placeholder={t('accounts.initial_balance_placeholder')}
                        className="text-center text-lg"
                      />
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <Users className="h-10 w-10 text-accent" />
                      <h2 className="text-xl font-bold">{t('onboarding.step_family')}</h2>
                    </div>
                    <Input
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      placeholder={t('onboarding.family_name_placeholder')}
                      className="text-center text-lg"
                      autoFocus
                    />
                    <button
                      onClick={goNext}
                      className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                    >
                      {t('onboarding.skip')}
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        <div className="mt-6 flex items-center justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={goBack}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              {t('onboarding.back')}
            </Button>
          ) : (
            <div />
          )}
          <Button onClick={goNext} disabled={loading || (step === 1 && !displayName.trim())}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : step === steps.length - 1 ? (
              t('onboarding.finish')
            ) : (
              <>
                {t('onboarding.next')}
                <ArrowRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
