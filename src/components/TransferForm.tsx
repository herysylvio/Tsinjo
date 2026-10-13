import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccounts } from '@/hooks/useAccounts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ArrowRightLeft, CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useKeyboardAwareScroll } from '@/hooks/useKeyboardAwareScroll';
import { useIsMobile } from '@/hooks/use-mobile';

interface TransferFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TransferForm = ({ open, onOpenChange }: TransferFormProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { accounts } = useAccounts();
  const queryClient = useQueryClient();

  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [transferDate, setTransferDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  const { containerRef, contentPaddingBottom, scrollToFocused } = useKeyboardAwareScroll({
    enabled: open && isMobile,
    chromeOffset: 220,
  });

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error(t('transactions.error_amount'));
      return;
    }
    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
      toast.error(t('transfer.error_same_account'));
      return;
    }

    setLoading(true);
    try {
      const fromAccount = accounts.find((a) => a.id === fromAccountId);
      const toAccount = accounts.find((a) => a.id === toAccountId);
      const note = description || `${fromAccount?.name} → ${toAccount?.name}`;

      const formattedDate = format(transferDate, 'yyyy-MM-dd');

      const { error } = await supabase.from('transactions').insert([
        {
          user_id: user!.id,
          type: 'expense' as const,
          amount: numAmount,
          category: 'transfer',
          description: note,
          account_id: fromAccountId,
          transaction_date: formattedDate,
        },
        {
          user_id: user!.id,
          type: 'income' as const,
          amount: numAmount,
          category: 'transfer',
          description: note,
          account_id: toAccountId,
          transaction_date: formattedDate,
        },
      ]);

      if (error) throw error;

      // Update savings goals linked to the destination account
      const { data: goals } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('account_id', toAccountId)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true });

      if (goals && goals.length > 0) {
        const goal = goals.find(g => Number(g.current_amount) < Number(g.target_amount)) ?? goals[0];
        const newAmount = Number(goal.current_amount) + numAmount;

        await supabase
          .from('savings_goals')
          .update({ current_amount: newAmount })
          .eq('id', goal.id)
          .eq('user_id', user!.id);

        await supabase
          .from('savings_deposits')
          .insert({ savings_goal_id: goal.id, user_id: user!.id, amount: numAmount });
      }

      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['global-balance'] });
      queryClient.invalidateQueries({ queryKey: ['savings_goals'] });
      queryClient.invalidateQueries({ queryKey: ['savings_deposits'] });

      toast.success(t('transfer.success'));
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error(t('transactions.error_generic'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFromAccountId('');
    setToAccountId('');
    setAmount('');
    setDescription('');
    setTransferDate(new Date());
  };

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            {t('transfer.title')}
          </DialogTitle>
        </DialogHeader>

        <div
          ref={containerRef}
          className="space-y-4 pt-2"
          style={{ paddingBottom: `${contentPaddingBottom}px`, overflowAnchor: 'none' }}
          onFocus={scrollToFocused}
        >
          {/* From account */}
          <div className="space-y-2">
            <Label>{t('transfer.from')}</Label>
            <Select value={fromAccountId} onValueChange={setFromAccountId}>
              <SelectTrigger>
                <SelectValue placeholder={t('transfer.select_account')} />
              </SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((a) => a.id !== toAccountId)
                  .map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: acc.color }}
                        />
                        {acc.name}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Arrow indicator */}
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-3 text-muted-foreground">
              {fromAccount && (
                <span className="text-xs font-medium" style={{ color: fromAccount.color }}>
                  {fromAccount.name}
                </span>
              )}
              <ArrowRightLeft className="h-4 w-4" />
              {toAccount && (
                <span className="text-xs font-medium" style={{ color: toAccount.color }}>
                  {toAccount.name}
                </span>
              )}
            </div>
          </div>

          {/* To account */}
          <div className="space-y-2">
            <Label>{t('transfer.to')}</Label>
            <Select value={toAccountId} onValueChange={setToAccountId}>
              <SelectTrigger>
                <SelectValue placeholder={t('transfer.select_account')} />
              </SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((a) => a.id !== fromAccountId)
                  .map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: acc.color }}
                        />
                        {acc.name}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>{t('transactions.amount')}</Label>
            <div className="relative">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="pr-10"
                min="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                Ar
              </span>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>{t('transfer.date')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !transferDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(transferDate, 'PPP')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={transferDate}
                  onSelect={(date) => date && setTransferDate(date)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>{t('transactions.description')}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('transfer.note_placeholder')}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              {t('transactions.cancel')}
            </Button>
            <Button
              className="flex-1 gap-1.5"
              onClick={handleSubmit}
              disabled={loading || !fromAccountId || !toAccountId || !amount}
            >
              <ArrowRightLeft className="h-4 w-4" />
              {t('transfer.confirm')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransferForm;
