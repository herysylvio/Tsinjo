import { useState } from 'react';
import tsinjoLogo from '@/assets/tsinjo-logo.png';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Lock, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'forgot';

const Auth = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const resetState = () => {
    setError(null);
    setSuccess(null);
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setPassword('');
    setConfirmPassword('');
    setPendingVerificationEmail(null);
    resetState();
  };

  const handleResendActivation = async () => {
    const targetEmail = pendingVerificationEmail ?? email.trim();
    if (!targetEmail) return;

    resetState();
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: targetEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setPendingVerificationEmail(targetEmail);
    setSuccess(t('auth.activation_resent'));
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();
    if (password.length < 6) {
      setError(t('auth.error_password_short'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.error_password_mismatch'));
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    setPendingVerificationEmail(email.trim());

    if (data.user?.identities?.length === 0) {
      setError(t('auth.error_signup_exists'));
      return;
    }

    setSuccess(t('auth.check_email'));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(t('auth.error_invalid_credentials'));
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSuccess(t('auth.reset_link_sent'));
    }
  };

  const handleSubmit = mode === 'signup' ? handleSignUp : mode === 'forgot' ? handleForgotPassword : handleLogin;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <img src={tsinjoLogo} alt="Tsinjo" className="mx-auto mb-4 h-16 w-16 rounded-2xl" />
          <h1 className="text-2xl font-bold tracking-tight">{t('auth.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('auth.subtitle')}</p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            {success ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 py-4 text-center"
              >
                <CheckCircle2 className="h-12 w-12 text-primary" />
                <h2 className="text-lg font-semibold">{success}</h2>
                <p className="text-sm text-muted-foreground">{t('auth.check_email_description')}</p>
                {pendingVerificationEmail && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResendActivation}
                    className="mt-1"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('auth.resend_activation')}
                  </Button>
                )}
                <Button variant="ghost" onClick={() => switchMode('login')} className="mt-1">
                  {t('auth.back_to_login')}
                </Button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.email_label')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('auth.email_placeholder')}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                {mode !== 'forgot' && (
                  <div className="space-y-2">
                    <Label htmlFor="password">{t('auth.password_label')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('auth.password_placeholder')}
                        className="pl-10 pr-10"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPassword ? t('auth.hide_password') : t('auth.show_password')}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'signup' && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{t('auth.confirm_password')}</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t('auth.confirm_password_placeholder')}
                        className="pl-10 pr-10"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showConfirmPassword ? t('auth.hide_password') : t('auth.show_password')}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : mode === 'signup' ? (
                    t('auth.sign_up')
                  ) : mode === 'forgot' ? (
                    t('auth.send_reset_link')
                  ) : (
                    t('auth.sign_in')
                  )}
                </Button>

                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="block w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {t('auth.forgot_password')}
                  </button>
                )}

                {mode === 'signup' && (
                  <button
                    type="button"
                    onClick={handleResendActivation}
                    disabled={loading || !email.trim()}
                    className="block w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t('auth.resend_activation')}
                  </button>
                )}

                <div className="text-center text-sm">
                  {mode === 'login' ? (
                    <span>
                      {t('auth.no_account')}{' '}
                      <button type="button" onClick={() => switchMode('signup')} className="font-semibold text-primary hover:underline">
                        {t('auth.sign_up')}
                      </button>
                    </span>
                  ) : (
                    <span>
                      {t('auth.already_have_account')}{' '}
                      <button type="button" onClick={() => switchMode('login')} className="font-semibold text-primary hover:underline">
                        {t('auth.sign_in')}
                      </button>
                    </span>
                  )}
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Auth;
