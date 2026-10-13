import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Crown, Check, Smartphone, Key, Sparkles, Clock } from 'lucide-react';
import { useSubscription, PLANS, SubscriptionPlan } from '@/hooks/useSubscription';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Premium = () => {
  const { t } = useTranslation();
  const { subscription, isPremium, remainingDays, activateLicenseCode, requestPayment } = useSubscription();

  const [licenseCode, setLicenseCode] = useState('');
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<'mvola' | 'orange_money'>('mvola');
  const [paymentReference, setPaymentReference] = useState('');

  const handleActivate = () => {
    if (licenseCode.trim().length < 6) return;
    activateLicenseCode.mutate(licenseCode.trim());
    setLicenseCode('');
  };

  const handlePaymentRequest = () => {
    if (!paymentReference.trim()) return;
    requestPayment.mutate({
      plan: selectedPlan,
      method: paymentMethod,
      reference: paymentReference.trim(),
    });
    setPaymentReference('');
    setPaymentDialog(false);
  };

  const selectedPlanInfo = PLANS.find(p => p.key === selectedPlan)!;

  return (
    <div className="animate-fade-in px-4 pt-6 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg">
          <Crown className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('premium.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('premium.subtitle')}</p>
        </div>
      </div>

      {/* Active subscription banner */}
      {isPremium && (
        <Card className="mb-6 border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                  {t('premium.active_subscription')}
                </p>
                <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
                  {t('premium.expires_in', { days: remainingDays })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending subscription */}
      {subscription?.status === 'pending' && (
        <Card className="mb-6 border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                  {t('premium.pending_validation')}
                </p>
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                  {t('premium.pending_desc')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pricing grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {PLANS.map((plan) => {
          const discount = plan.pricePerMonth < PLANS[0].pricePerMonth
            ? Math.round((1 - plan.pricePerMonth / PLANS[0].pricePerMonth) * 100)
            : 0;
          return (
            <Card
              key={plan.key}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedPlan === plan.key ? 'border-primary ring-2 ring-primary/20' : ''
              }`}
              onClick={() => setSelectedPlan(plan.key)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold">{plan.duration}</p>
                    <p className="text-2xl font-bold text-foreground">
                      {plan.price.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">Ar</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {plan.pricePerMonth.toLocaleString()} Ar/{t('premium.per_month')}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {discount > 0 && (
                      <Badge className="bg-amber-500 text-white hover:bg-amber-600">
                        -{discount}%
                      </Badge>
                    )}
                    {selectedPlan === plan.key && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Features */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <p className="text-sm font-semibold mb-3">{t('premium.features_title')}</p>
          <ul className="space-y-2">
            {['ai_coach', 'family', 'multi_accounts', 'recurring', 'export', 'themes'].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary shrink-0" />
                {t(`premium.feature_${f}`)}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Mobile Money Payment */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{t('premium.mobile_money')}</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{t('premium.mobile_money_desc')}</p>
          <Button className="w-full" onClick={() => setPaymentDialog(true)}>
            {t('premium.pay_mobile_money')}
          </Button>
        </CardContent>
      </Card>

      {/* License Code */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Key className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{t('premium.license_code')}</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{t('premium.license_desc')}</p>
          <div className="flex gap-2">
            <Input
              value={licenseCode}
              onChange={(e) => setLicenseCode(e.target.value.toUpperCase())}
              placeholder="TSINJO-XXX-XXX"
              className="font-mono tracking-wider"
            />
            <Button
              onClick={handleActivate}
              disabled={activateLicenseCode.isPending || licenseCode.trim().length < 6}
            >
              {t('premium.activate')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('premium.payment_title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-3 bg-muted/30">
              <p className="text-sm font-medium">{t('premium.selected_plan')}: {selectedPlanInfo.duration}</p>
              <p className="text-lg font-bold">{selectedPlanInfo.price.toLocaleString()} Ar</p>
            </div>

            <div className="space-y-2">
              <Label>{t('premium.payment_method')}</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'mvola' | 'orange_money')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mvola">Mvola</SelectItem>
                  <SelectItem value="orange_money">Orange Money</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border border-primary/20 p-3 bg-primary/5">
              <p className="text-sm font-semibold mb-2">{t('premium.instructions')}</p>
              {paymentMethod === 'mvola' ? (
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>1. {t('premium.mvola_step1')}</p>
                  <p className="font-mono text-foreground font-semibold">034 XX XXX XX</p>
                  <p>2. {t('premium.mvola_step2', { amount: selectedPlanInfo.price.toLocaleString() })}</p>
                  <p>3. {t('premium.mvola_step3')}</p>
                </div>
              ) : (
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>1. {t('premium.orange_step1')}</p>
                  <p className="font-mono text-foreground font-semibold">032 XX XXX XX</p>
                  <p>2. {t('premium.orange_step2', { amount: selectedPlanInfo.price.toLocaleString() })}</p>
                  <p>3. {t('premium.orange_step3')}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('premium.reference')}</Label>
              <Input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder={t('premium.reference_placeholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handlePaymentRequest} disabled={!paymentReference.trim() || requestPayment.isPending}>
              {t('premium.confirm_payment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Premium;
