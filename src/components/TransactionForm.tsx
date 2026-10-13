import { useState, useEffect, useRef, useCallback } from 'react';
import { useKeyboardAwareScroll } from '@/hooks/useKeyboardAwareScroll';
import { useTranslation } from 'react-i18next';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useTransactions, Transaction, TransactionType, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/hooks/useTransactions';
import { useUserCategories } from '@/hooks/useUserCategories';
import { toast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { Upload, X, FileText, BookmarkPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAccounts } from '@/hooks/useAccounts';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: TransactionType;
  editTransaction?: Transaction | null;
}

const TransactionForm = ({ open, onOpenChange, defaultType = 'expense', editTransaction }: TransactionFormProps) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { activeAccountId, activeAccount } = useAccounts();
  const isSharedViewer = activeAccount?.shared && activeAccount?.sharedRole === 'viewer';
  const isSharedAccount = activeAccount?.shared === true;
  const { addTransaction, updateTransaction, transactions, balance } = useTransactions({ accountId: activeAccountId });
  const { user } = useAuth();

  const isEdit = !!editTransaction;

  const [type, setType] = useState<TransactionType>(defaultType);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [saveCategoryPrompt, setSaveCategoryPrompt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { categories: userCategories, addCategory } = useUserCategories(type, activeAccountId);

  useEffect(() => {
    if (editTransaction && open && isSharedAccount) {
      onOpenChange(false);
      toast({ title: t('transactions.edit_not_allowed'), variant: 'destructive' });
      return;
    }
    if (editTransaction && open) {
      setType(editTransaction.type);
      setAmount(String(editTransaction.amount));
      const cat = editTransaction.category;
      if (cat.startsWith('other_expense:')) {
        setCategory('other_expense');
        setCustomCategory(cat.substring('other_expense:'.length));
      } else if (cat.startsWith('other_income:')) {
        setCategory('other_income');
        setCustomCategory(cat.substring('other_income:'.length));
      } else if (cat.startsWith('custom:')) {
        setCategory(cat);
        setCustomCategory('');
      } else {
        setCategory(cat);
        setCustomCategory('');
      }
      setDescription(editTransaction.description || '');
      setDate(editTransaction.transaction_date);
      setReceiptFile(null);
    } else if (open && !editTransaction) {
      setType(defaultType);
      resetForm();
    }
  }, [editTransaction, open]);

  const defaultCategories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const resetForm = () => {
    setAmount('');
    setCategory('');
    setDescription('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setReceiptFile(null);
    setCustomCategory('');
  };

  const uploadReceipt = async (file: File): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('receipts').upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from('receipts').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (isSharedViewer) return;
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast({ title: t('transactions.error_amount'), variant: 'destructive' });
      return;
    }
    if (!category) {
      toast({ title: t('transactions.error_category'), variant: 'destructive' });
      return;
    }

    try {
      setUploading(true);
      let receipt_url: string | undefined;
      if (receiptFile) {
        receipt_url = (await uploadReceipt(receiptFile)) ?? undefined;
      }

      const isOtherWithCustom = (category === 'other_expense' || category === 'other_income') && customCategory.trim();
      const finalCategory = isOtherWithCustom
        ? `${category}:${customCategory.trim()}`
        : category;

      if (isEdit) {
        await updateTransaction.mutateAsync({
          id: editTransaction.id,
          type,
          amount: numAmount,
          category: finalCategory,
          description: description.trim() || undefined,
          transaction_date: date,
          ...(receipt_url && { receipt_url }),
        });
        toast({ title: t('transactions.updated') });
      } else {
        await addTransaction.mutateAsync({
          type,
          amount: numAmount,
          category: finalCategory,
          description: description.trim() || undefined,
          transaction_date: date,
          ...(receipt_url && { receipt_url }),
          ...(activeAccountId && { account_id: activeAccountId }),
        });
        toast({ title: t('transactions.success') });
      }

      // After successful submission, check if we should offer to save custom category
      if (isOtherWithCustom) {
        const customName = customCategory.trim();
        const alreadySaved = userCategories.some(c => c.name.toLowerCase() === customName.toLowerCase());
        if (!alreadySaved) {
          setSaveCategoryPrompt(customName);
        }
      }

      resetForm();
      onOpenChange(false);
    } catch {
      toast({ title: t('transactions.error_generic'), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveCategory = async () => {
    if (!saveCategoryPrompt) return;
    try {
      await addCategory.mutateAsync({ name: saveCategoryPrompt, type, account_id: activeAccountId });
      toast({ title: t('transactions.category_saved') });
    } catch {
      // duplicate or error — silently ignore
    }
    setSaveCategoryPrompt(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      setReceiptFile(file);
    }
  }, []);

  const isPending = uploading || (isEdit ? updateTransaction.isPending : addTransaction.isPending) || isSharedViewer;

  // Monthly expense for impact panel
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const monthExpenses = transactions.filter(
    (tx) => tx.type === 'expense' && parseISO(tx.transaction_date) >= monthStart && parseISO(tx.transaction_date) <= monthEnd
  );
  const monthTotal = monthExpenses.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const recentTx = transactions.slice(0, 3);
  const estimatedImpact = type === 'expense' ? parseFloat(amount) || 0 : 0;

  const formContent = (
    <div className="space-y-4">
      {/* Type toggle */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={type === 'expense' ? 'default' : 'outline'}
          className={type === 'expense' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          onClick={() => { setType('expense'); setCategory(''); }}
        >
          {t('transactions.expense')}
        </Button>
        <Button
          type="button"
          variant={type === 'income' ? 'default' : 'outline'}
          className={type === 'income' ? 'bg-success text-success-foreground hover:bg-success/90' : ''}
          onClick={() => { setType('income'); setCategory(''); }}
        >
          {t('transactions.income')}
        </Button>
      </div>

      {/* Date + Category row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>{t('transactions.date')}</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t('transactions.category')}</Label>
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
      </div>

      {/* Custom category name */}
      {(category === 'other_expense' || category === 'other_income') && (
        <div className="space-y-2">
          <Label>{t('transactions.custom_category_placeholder')}</Label>
          <Input
            placeholder={t('transactions.custom_category_placeholder')}
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
          />
        </div>
      )}

      {/* Amount */}
      <div className="space-y-2">
        <Label>{t('transactions.amount')} (Ar)</Label>
        <Input
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="text-2xl font-bold h-14"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label>{t('transactions.description')}</Label>
        <Textarea
          placeholder={t('transactions.description_placeholder')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>

      {/* Receipt upload */}
      <div className="space-y-2">
        <Label>{t('transactions.receipt')}</Label>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-4 cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/50"
        >
          {receiptFile ? (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <span className="truncate max-w-[200px]">{receiptFile.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={(e) => { e.stopPropagation(); setReceiptFile(null); }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground text-sm">
              <Upload className="h-5 w-5" />
              <span>{t('transactions.upload_receipt')}</span>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setReceiptFile(file);
          }}
        />
      </div>
    </div>
  );

  const impactPanel = (
    <div className="space-y-4 rounded-lg bg-muted/50 p-4">
      <h3 className="font-semibold text-foreground">{t('transactions.impact_title')}</h3>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('transactions.month_expenses')}</span>
          <span className="font-medium text-destructive">-{monthTotal.toLocaleString()} Ar</span>
        </div>
        {estimatedImpact > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('transactions.estimated_impact')}</span>
            <span className="font-bold text-destructive">-{estimatedImpact.toLocaleString()} Ar</span>
          </div>
        )}
        <div className="flex justify-between text-sm border-t border-border pt-2">
          <span className="text-muted-foreground">{t('dashboard.balance')}</span>
          <span className="font-bold text-foreground">{balance.balance.toLocaleString()} Ar</span>
        </div>
      </div>

      {recentTx.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('transactions.recent')}
          </p>
          {recentTx.map((tx) => (
            <div key={tx.id} className="flex justify-between text-sm">
              <span className="truncate text-muted-foreground">{t(`transactions.categories.${tx.category}`)}</span>
              <span className={tx.type === 'expense' ? 'text-destructive' : 'text-success'}>
                {tx.type === 'expense' ? '-' : '+'}{Number(tx.amount).toLocaleString()} Ar
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const title = isEdit
    ? t('transactions.edit_transaction')
    : type === 'expense'
      ? t('transactions.add_expense')
      : t('transactions.add_income');

  const actionButtons = (
    <>
      <Button
        onClick={handleSubmit}
        disabled={isPending}
        className={type === 'expense'
          ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
          : 'bg-success text-success-foreground hover:bg-success/90'
        }
      >
        {isPending ? '...' : isEdit ? t('transactions.update') : t('transactions.save')}
      </Button>
    </>
  );

  const {
    containerRef: drawerScrollRef,
    contentHeight: drawerContentHeight,
    contentPaddingBottom: drawerPaddingBottom,
    scrollToFocused,
  } = useKeyboardAwareScroll({ enabled: open && isMobile, chromeOffset: 180 });

  // Save category prompt dialog
  const saveCategoryDialog = (
    <AlertDialog open={!!saveCategoryPrompt} onOpenChange={(o) => !o && setSaveCategoryPrompt(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <BookmarkPlus className="h-5 w-5 text-primary" />
            {t('transactions.save_category_title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('transactions.save_category_desc', { name: saveCategoryPrompt })}
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
  );

  // Mobile: Drawer
  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>{title}</DrawerTitle>
            </DrawerHeader>
            <div
              ref={drawerScrollRef}
              className="px-4 overflow-y-auto"
              style={{
                maxHeight: drawerContentHeight ? `${drawerContentHeight}px` : '60vh',
                paddingBottom: `${drawerPaddingBottom}px`,
                overflowAnchor: 'none',
              }}
              onFocus={scrollToFocused}
            >{formContent}</div>
            <DrawerFooter>
              {actionButtons}
              <DrawerClose asChild>
                <Button variant="outline">{t('transactions.cancel')}</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
        {saveCategoryDialog}
      </>
    );
  }

  // Desktop: Dialog with 2-column layout
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
          <div className="grid grid-cols-5">
            {/* Left: Form (3/5) */}
            <div className="col-span-3 p-6 space-y-4">
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
              </DialogHeader>
              {formContent}
              <DialogFooter className="pt-2">
                {actionButtons}
                <DialogClose asChild>
                  <Button variant="outline">{t('transactions.cancel')}</Button>
                </DialogClose>
              </DialogFooter>
            </div>

            {/* Right: Impact panel (2/5) */}
            <div className="col-span-2 border-l border-border bg-muted/20 p-6 flex flex-col justify-center">
              {impactPanel}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {saveCategoryDialog}
    </>
  );
};

export default TransactionForm;
