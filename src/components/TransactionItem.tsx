import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Transaction, useTransactions } from '@/hooks/useTransactions';
import {
  Utensils, Car, HeartPulse, GraduationCap, Gamepad2,
  Home, Briefcase, HandCoins, Gift, MoreHorizontal, Trash2, ArrowRightLeft, Pencil,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  food: Utensils, transport: Car, health: HeartPulse,
  education: GraduationCap, leisure: Gamepad2, housing: Home,
  salary: Briefcase, freelance: HandCoins, gift: Gift,
  other_expense: MoreHorizontal, other_income: MoreHorizontal,
  transfer: ArrowRightLeft,
};

interface TransactionItemProps {
  transaction: Transaction;
  onEdit?: (transaction: Transaction) => void;
  discreet?: boolean;
  readOnly?: boolean;
}

const TransactionItem = ({ transaction, onEdit, discreet, readOnly }: TransactionItemProps) => {
  const { t } = useTranslation();
  const { deleteTransaction } = useTransactions();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [startX, setStartX] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const Icon = CATEGORY_ICONS[transaction.category] || MoreHorizontal;
  const isExpense = transaction.type === 'expense';

  const handleDelete = async () => {
    try {
      await deleteTransaction.mutateAsync(transaction);
      toast({ title: t('transactions.deleted') });
    } catch {
      toast({ title: t('transactions.error_generic'), variant: 'destructive' });
    }
    setConfirmOpen(false);
    setOffsetX(0);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (readOnly) return;
    setStartX(e.touches[0].clientX);
    setSwiping(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!swiping) return;
    const diff = e.touches[0].clientX - startX;
    if (diff < 0) setOffsetX(Math.max(diff, -100));
  };

  const onTouchEnd = () => {
    setSwiping(false);
    if (offsetX < -60) {
      setConfirmOpen(true);
    }
    setOffsetX(0);
  };

  const handleClick = () => {
    if (offsetX === 0 && onEdit && !readOnly) {
      onEdit(transaction);
    }
  };

  return (
    <>
      <div className="relative overflow-hidden">
        {/* Delete background — only visible during swipe */}
        {offsetX < 0 && (
          <div className="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-destructive text-destructive-foreground">
            <Trash2 className="h-5 w-5" />
          </div>
        )}

        {/* Swipeable content */}
        <div
          className="group relative z-10 flex items-center gap-3 py-3 px-3 bg-card transition-transform cursor-pointer hover:bg-muted/50"
          style={{ transform: `translateX(${offsetX}px)` }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onContextMenu={(e) => { e.preventDefault(); if (!readOnly) setConfirmOpen(true); }}
          onClick={handleClick}
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isExpense ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
          }`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {transaction.category.startsWith('other_expense:') || transaction.category.startsWith('other_income:')
                ? transaction.category.split(':').slice(1).join(':')
                : t(`transactions.categories.${transaction.category}`)}
            </p>
            {transaction.description && (
              <p className="text-xs text-muted-foreground truncate">{transaction.description}</p>
            )}
          </div>
          {!readOnly && onEdit && (
            <button
              className="hidden md:flex items-center justify-center h-8 w-8 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:bg-primary/10"
              onClick={(e) => { e.stopPropagation(); onEdit(transaction); }}
              aria-label={t('transactions.update')}
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {!readOnly && (
            <button
              className="hidden md:flex items-center justify-center h-8 w-8 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
              onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
              aria-label={t('transactions.delete')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <span className={`text-sm font-semibold tabular-nums ${
            isExpense ? 'text-destructive' : 'text-success'
          }`}>
            {discreet ? '••••••' : `${isExpense ? '-' : '+'}${Number(transaction.amount).toLocaleString()} Ar`}
          </span>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('transactions.delete_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('transactions.delete_confirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('transactions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('transactions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TransactionItem;
