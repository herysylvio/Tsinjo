import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Key, Plus, Copy, Check, Users, CreditCard } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { SubscriptionPlan } from '@/hooks/useSubscription';

export function AdminLicenseCodes() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [generateDialog, setGenerateDialog] = useState(false);
  const [plan, setPlan] = useState<SubscriptionPlan>('monthly');
  const [count, setCount] = useState('5');
  const [batchName, setBatchName] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Check if user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc('has_role', { _user_id: user!.id, _role: 'admin' });
      return !!data;
    },
    enabled: !!user,
  });

  // Fetch license codes
  const { data: codes = [] } = useQuery({
    queryKey: ['license-codes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('license_codes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  // Fetch pending subscriptions
  const { data: pendingSubs = [] } = useQuery({
    queryKey: ['pending-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  const generateCodes = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('generate_license_codes', {
        _plan: plan,
        _count: parseInt(count),
        _batch: batchName || `Lot_${new Date().toISOString().slice(0, 10)}`,
        _admin_id: user!.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['license-codes'] });
      toast({ title: t('premium.admin_codes_generated') });
      setGenerateDialog(false);
      setBatchName('');
    },
  });

  // Validate a pending payment
  const validatePayment = useMutation({
    mutationFn: async (subId: string) => {
      // We need to find the subscription to get the plan
      const sub = pendingSubs.find(s => s.id === subId);
      if (!sub) throw new Error('Subscription not found');

      const durationMap: Record<string, string> = {
        monthly: '1 month',
        quarterly: '3 months',
        semi_annual: '6 months',
        annual: '1 year',
      };

      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          starts_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + parseDuration(durationMap[sub.plan])).toISOString(),
        })
        .eq('id', subId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-subscriptions'] });
      toast({ title: t('premium.admin_payment_validated') });
    },
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (!isAdmin) return null;

  const planLabels: Record<string, string> = {
    monthly: '1 mois',
    quarterly: '3 mois',
    semi_annual: '6 mois',
    annual: '12 mois',
  };

  const availableCodes = codes.filter(c => !c.is_used);
  const usedCodes = codes.filter(c => c.is_used);

  return (
    <div className="space-y-4">
      {/* Pending Payments */}
      {pendingSubs.length > 0 && (
        <Card className="border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold">{t('premium.admin_pending_payments')} ({pendingSubs.length})</span>
            </div>
            <div className="space-y-2">
              {pendingSubs.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{sub.payment_reference}</p>
                    <p className="text-xs text-muted-foreground">
                      {planLabels[sub.plan]} • {sub.payment_method === 'mvola' ? 'Mvola' : 'Orange Money'}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => validatePayment.mutate(sub.id)} disabled={validatePayment.isPending}>
                    {t('premium.admin_validate')}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* License Codes Manager */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{t('premium.admin_license_codes')}</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => setGenerateDialog(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t('premium.admin_generate')}
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-lg bg-muted/50 p-2 text-center">
              <p className="text-lg font-bold text-primary">{availableCodes.length}</p>
              <p className="text-xs text-muted-foreground">{t('premium.admin_available')}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-2 text-center">
              <p className="text-lg font-bold">{usedCodes.length}</p>
              <p className="text-xs text-muted-foreground">{t('premium.admin_used')}</p>
            </div>
          </div>

          {/* Available codes */}
          {availableCodes.length > 0 && (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {availableCodes.map((code) => (
                <div key={code.id} className="flex items-center justify-between rounded border border-border px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold">{code.code}</span>
                    <Badge variant="outline" className="text-[10px]">{planLabels[code.plan]}</Badge>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => copyCode(code.code)}
                  >
                    {copiedCode === code.code ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Dialog */}
      <Dialog open={generateDialog} onOpenChange={setGenerateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('premium.admin_generate_title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('premium.admin_plan')}</Label>
              <Select value={plan} onValueChange={(v) => setPlan(v as SubscriptionPlan)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">1 mois - 14 500 Ar</SelectItem>
                  <SelectItem value="quarterly">3 mois - 39 000 Ar</SelectItem>
                  <SelectItem value="semi_annual">6 mois - 69 000 Ar</SelectItem>
                  <SelectItem value="annual">12 mois - 98 000 Ar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('premium.admin_quantity')}</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('premium.admin_batch_name')}</Label>
              <Input
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="Ex: Revendeur_Tana_Avril2026"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => generateCodes.mutate()} disabled={generateCodes.isPending}>
              {t('premium.admin_generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function parseDuration(duration: string): number {
  const map: Record<string, number> = {
    '1 month': 30 * 24 * 60 * 60 * 1000,
    '3 months': 90 * 24 * 60 * 60 * 1000,
    '6 months': 180 * 24 * 60 * 60 * 1000,
    '1 year': 365 * 24 * 60 * 60 * 1000,
  };
  return map[duration] || 30 * 24 * 60 * 60 * 1000;
}
