import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useRecurringTransactions, RecurringTransaction, Frequency, ConfirmationMode } from '@/hooks/useRecurringTransactions';
import { TransactionType, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/useAccounts';
import { useUserCategories } from '@/hooks/useUserCategories';
import { toast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Trash2, TrendingDown, TrendingUp, Calendar, BookmarkPlus, BellRing, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useKeyboardAwareScroll } from '@/hooks/useKeyboardAwareScroll';
import { useIsMobile } from '@/hooks/use-mobile';

interface RecurringTransactionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RecurringTransactions = ({ open, onOpenChange }: RecurringTransactionsProps) => {
  const { t } = useTranslation();
  const { activeAccountId } = useAccounts();
  const { recurringTransactions, isLoading, addRecurring, updateRecurring, deleteRecurring } = useRecurringTransactions(activeAccountId);
  const [showForm, setShowForm] = useState(false);
  const isMobile = useIsMobile();
  const { containerRef, contentPaddingBottom, scrollToFocused } = useKeyboardAwareScroll({
    enabled: open && isMobile && showForm,
    chromeOffset: 120,
  });

  // Form state
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [nextDueDate, setNextDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [confirmationMode, setConfirmationMode] = useState<ConfirmationMode>('manual');
  const [saveCategoryPrompt, setSaveCategoryPrompt] = useState<{ name: string; type: TransactionType } | null>(null);

  // Calculate missed occurrences if next_due_date is in the past
  const missedCount = (() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (nextDueDate >= todayStr) return 0;
    let count = 0;
    let cursor = new Date(nextDueDate);
    const today = new Date(todayStr);
    while (cursor <= today && count < 500) {
      count++;
      const d = new Date(cursor);
      switch (frequency) {
        case 'daily': d.setDate(d.getDate() + 1); break;
        case 'weekly': d.setDate(d.getDate() + 7); break;
        case 'bimonthly': d.setMonth(d.getMonth() + 2); break;
        case 'quarterly': d.setMonth(d.getMonth() + 3); break;
        case 'semi_annual': d.setMonth(d.getMonth() + 6); break;
        case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
        case 'monthly': default: d.setMonth(d.getMonth() + 1); break;
      }
      cursor = d;
    }
    return count;
  })();

  const { categories: userCategories, addCategory } = useUserCategories(type, activeAccountId);
  const defaultCategories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const resetForm = () => {
    setAmount('');
    setCategory('');
    setCustomCategory('');
    setDescription('');
    setFrequency('monthly');
    setNextDueDate(format(new Date(), 'yyyy-MM-dd'));
    setConfirmationMode('manual');
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!activeAccountId) {
      toast({ title: t('recurring.no_account'), variant: 'destructive' });
      return;
    }
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast({ title: t('transactions.error_amount'), variant: 'destructive' });
      return;
    }
    if (!category) {
      toast({ title: t('transactions.error_category'), variant: 'destructive' });
      return;
    }

    const isOtherWithCustom = (category === 'other_expense' || category === 'other_income') && customCategory.trim();
    const finalCategory = isOtherWithCustom
      ? `${category}:${customCategory.trim()}`
      : category;

    try {
      await addRecurring.mutateAsync({
        type,
        amount: numAmount,
        category: finalCategory,
        description: description.trim() || undefined,
        frequency,
        next_due_date: nextDueDate,
        account_id: activeAccountId!,
        confirmation_mode: confirmationMode,
      });
      toast({ title: t('recurring.created') });

      if (isOtherWithCustom) {
        const customName = customCategory.trim();
        const alreadySaved = userCategories.some(c => c.name.toLowerCase() === customName.toLowerCase());
        if (!alreadySaved) {
          setSaveCategoryPrompt({ name: customName, type });
        }
      }

      resetForm();
    } catch {
      toast({ title: t('transactions.error_generic'), variant: 'destructive' });
    }
  };

  const handleSaveCategory = async () => {
    if (!saveCategoryPrompt) return;
    try {
      await addCategory.mutateAsync({
        name: saveCategoryPrompt.name,
        type: saveCategoryPrompt.type,
        account_id: activeAccountId,
      });
      toast({ title: t('transactions.category_saved') });
    } catch {
      // duplicate or error — silently ignore
    }
    setSaveCategoryPrompt(null);
  };

  const handleToggle = async (rec: RecurringTransaction) => {
    try {
      await updateRecurring.mutateAsync({ id: rec.id, is_active: !rec.is_active });
    } catch {
      toast({ title: t('transactions.error_generic'), variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRecurring.mutateAsync(id);
      toast({ title: t('recurring.deleted') });
    } catch {
      toast({ title: t('transactions.error_generic'), variant: 'destructive' });
    }
  };

  const frequencyLabel = (f: string) => t(`recurring.freq_${f}`);

  // Render category label, supporting "other_*:name" and "custom:name"
  const renderCategoryLabel = (cat: string) => {
    if (cat.startsWith('other_expense:')) return cat.substring('other_expense:'.length);
    if (cat.startsWith('other_income:')) return cat.substring('other_income:'.length);
    if (cat.startsWith('custom:')) return cat.substring('custom:'.length);
    return t(`transactions.categories.${cat}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('recurring.title')}</SheetTitle>
        </SheetHeader>

        <div
          ref={containerRef}
          className="mt-4 space-y-4"
          style={{ paddingBottom: `${contentPaddingBottom}px`, overflowAnchor: 'none' }}
          onFocus={scrollToFocused}
        >
          {/* Add button */}
          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              {t('recurring.add')}
            </Button>
          )}

          {/* Creation form */}
          {showForm && (
            <Card>
              <CardContent className="p-4 space-y-3">
                {/* Type toggle */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={type === 'expense' ? 'default' : 'outline'}
                    className={type === 'expense' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                    onClick={() => { setType('expense'); setCategory(''); setCustomCategory(''); }}
                  >
                    {t('transactions.expense')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={type === 'income' ? 'default' : 'outline'}
                    className={type === 'income' ? 'bg-success text-success-foreground hover:bg-success/90' : ''}
                    onClick={() => { setType('income'); setCategory(''); setCustomCategory(''); }}
                  >
                    {t('transactions.income')}
                  </Button>
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <Label className="text-xs">{t('transactions.category')}</Label>
                  <Select value={category} onValueChange={(val) => { setCategory(val); setCustomCategory(''); }}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('transactions.select_category')} />
                    </SelectTrigger>
                    <SelectContent>
                      {defaultCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {t(`transactions.categories.${cat}`)}
                        </SelectItem>
                      ))}
                      {userCategories.length > 0 && (
                        <>
                          <Separator className="my-1" />
                          {userCategories.map((uc) => (
                            <SelectItem key={`custom:${uc.name}`} value={`custom:${uc.name}`}>
                              {uc.name}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom category name */}
                {(category === 'other_expense' || category === 'other_income') && (
                  <div className="space-y-1">
                    <Label className="text-xs">{t('transactions.custom_category_placeholder')}</Label>
                    <Input
                      placeholder={t('transactions.custom_category_placeholder')}
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                    />
                  </div>
                )}

                {/* Amount */}
                <div className="space-y-1">
                  <Label className="text-xs">{t('transactions.amount')} (Ar)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                {/* Frequency */}
                <div className="space-y-1">
                  <Label className="text-xs">{t('recurring.frequency')}</Label>
                  <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{t('recurring.freq_daily')}</SelectItem>
                      <SelectItem value="weekly">{t('recurring.freq_weekly')}</SelectItem>
                      <SelectItem value="monthly">{t('recurring.freq_monthly')}</SelectItem>
                      <SelectItem value="bimonthly">{t('recurring.freq_bimonthly')}</SelectItem>
                      <SelectItem value="quarterly">{t('recurring.freq_quarterly')}</SelectItem>
                      <SelectItem value="semi_annual">{t('recurring.freq_semi_annual')}</SelectItem>
                      <SelectItem value="yearly">{t('recurring.freq_yearly')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Next due date */}
                <div className="space-y-1">
                  <Label className="text-xs">{t('recurring.next_date')}</Label>
                  <Input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
                  {missedCount > 0 && (
                    <p className="text-xs text-primary mt-1">
                      {t('recurring.missed_occurrences', { count: missedCount })}
                    </p>
                  )}
                </div>

                {/* Confirmation mode */}
                <div className="space-y-1">
                  <Label className="text-xs">{t('recurring.mode')}</Label>
                  <Select value={confirmationMode} onValueChange={(v) => setConfirmationMode(v as ConfirmationMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">{t('recurring.mode_manual')}</SelectItem>
                      <SelectItem value="auto">{t('recurring.mode_auto')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {confirmationMode === 'auto' ? t('recurring.mode_auto_desc') : t('recurring.mode_manual_desc')}
                  </p>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <Label className="text-xs">{t('transactions.description')}</Label>
                  <Textarea
                    placeholder={t('transactions.description_placeholder')}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button onClick={handleSubmit} disabled={addRecurring.isPending} className="flex-1" size="sm">
                    {addRecurring.isPending ? '...' : t('transactions.save')}
                  </Button>
                  <Button variant="outline" onClick={resetForm} size="sm">
                    {t('transactions.cancel')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* List */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : recurringTransactions.length === 0 && !showForm ? (
            <p className="text-center text-sm text-muted-foreground py-8">{t('recurring.empty')}</p>
          ) : (
            <div className="space-y-2">
              {recurringTransactions.map((rec) => {
                const hasDescription = !!rec.description?.trim();
                const title = hasDescription ? rec.description! : renderCategoryLabel(rec.category);
                const subtitle = hasDescription ? renderCategoryLabel(rec.category) : null;
                return (
                <Card key={rec.id} className={`border-border/50 ${!rec.is_active ? 'opacity-60' : ''}`}>
                  <CardContent className="p-3.5 flex flex-col gap-2.5">
                    {/* Row 1: icon + title + amount */}
                    <div className="flex items-start gap-3">
                      <div className={`shrink-0 rounded-full p-2 ${rec.type === 'expense' ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                        {rec.type === 'expense' ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{title}</p>
                        {subtitle && (
                          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                        )}
                      </div>
                      <p className={`text-sm font-bold whitespace-nowrap ${rec.type === 'expense' ? 'text-destructive' : 'text-success'}`}>
                        {rec.type === 'expense' ? '-' : '+'}{Number(rec.amount).toLocaleString()} Ar
                      </p>
                    </div>

                    {/* Row 2: badges + actions */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="gap-1 font-normal">
                          <Calendar className="h-3 w-3" />
                          {frequencyLabel(rec.frequency)}
                        </Badge>
                        {rec.confirmation_mode === 'manual' ? (
                          <Badge variant="outline" className="gap-1 font-normal border-primary/40 text-primary">
                            <BellRing className="h-3 w-3" />
                            {t('recurring.badge_manual')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 font-normal border-success/40 text-success">
                            <Zap className="h-3 w-3" />
                            {t('recurring.badge_auto')}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(rec.next_due_date), 'd MMM yyyy', { locale: fr })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 ml-auto">
                        <Switch
                          checked={rec.is_active}
                          onCheckedChange={() => handleToggle(rec)}
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('recurring.delete_title')}</AlertDialogTitle>
                              <AlertDialogDescription>{t('recurring.delete_confirm')}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('transactions.cancel')}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(rec.id)}>
                                {t('transactions.delete')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Save category prompt */}
        <AlertDialog open={!!saveCategoryPrompt} onOpenChange={(o) => !o && setSaveCategoryPrompt(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <BookmarkPlus className="h-5 w-5 text-primary" />
                {t('transactions.save_category_title')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('transactions.save_category_desc', { name: saveCategoryPrompt?.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('transactions.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleSaveCategory}>
                {t('transactions.save_category_confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
};

export default RecurringTransactions;
