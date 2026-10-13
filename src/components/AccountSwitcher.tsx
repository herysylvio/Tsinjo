import { useTranslation } from 'react-i18next';
import { Wallet, Plus, ChevronDown, Briefcase, PiggyBank, CreditCard, Home, Car, GraduationCap, Heart, ShoppingBag, Plane, Building2, Smartphone, Users, Eye, Pencil } from 'lucide-react';
import { useAccounts } from '@/hooks/useAccounts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  wallet: Wallet,
  briefcase: Briefcase,
  piggybank: PiggyBank,
  card: CreditCard,
  home: Home,
  car: Car,
  graduation: GraduationCap,
  heart: Heart,
  shopping: ShoppingBag,
  plane: Plane,
  building: Building2,
  smartphone: Smartphone,
};

export const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

interface AccountSwitcherProps {
  collapsed?: boolean;
}

export function AccountSwitcher({ collapsed = false }: AccountSwitcherProps) {
  const { t } = useTranslation();
  const { ownAccounts, sharedAccounts, activeAccount, switchAccount, addAccount } = useAccounts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [newIcon, setNewIcon] = useState('wallet');
  const [newBalance, setNewBalance] = useState('');

  if (!activeAccount) return null;

  const ActiveIcon = ICON_MAP[activeAccount.icon] || Wallet;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await addAccount.mutateAsync({ name: newName.trim(), color: newColor, icon: newIcon, initialBalance: parseFloat(newBalance) || 0 });
    setNewName('');
    setNewColor(COLORS[0]);
    setNewIcon('wallet');
    setNewBalance('');
    setDialogOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 w-full rounded-lg px-3 py-2 hover:bg-sidebar-accent transition-colors text-left">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: activeAccount.color + '20', color: activeAccount.color }}
            >
              <ActiveIcon className="h-4 w-4" />
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {activeAccount.name}
                  </span>
                  {activeAccount.shared && (
                    <span className="block text-[10px] text-muted-foreground truncate">
                      {activeAccount.owner_name} · {activeAccount.sharedRole === 'editor' ? t('accounts.role_editor') : t('accounts.role_viewer')}
                    </span>
                  )}
                </div>
                {activeAccount.shared && (
                  <Users className="h-3 w-3 text-primary shrink-0" />
                )}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {/* Own accounts */}
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t('accounts.title')}
          </DropdownMenuLabel>
          {ownAccounts.map((acc) => {
            const Icon = ICON_MAP[acc.icon] || Wallet;
            return (
              <DropdownMenuItem
                key={acc.id}
                onClick={() => switchAccount(acc.id)}
                className="flex items-center gap-2"
              >
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-md"
                  style={{ backgroundColor: acc.color + '20', color: acc.color }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="flex-1 truncate">{acc.name}</span>
                {acc.id === activeAccount.id && (
                  <span className="text-xs text-primary">●</span>
                )}
              </DropdownMenuItem>
            );
          })}

          {/* Shared accounts */}
          {sharedAccounts.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {t('accounts.shared_with_me')}
              </DropdownMenuLabel>
              {sharedAccounts.map((acc) => {
                const Icon = ICON_MAP[acc.icon] || Wallet;
                return (
                  <DropdownMenuItem
                    key={acc.id}
                    onClick={() => switchAccount(acc.id)}
                    className="flex items-center gap-2"
                  >
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-md relative"
                      style={{ backgroundColor: acc.color + '20', color: acc.color }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block truncate text-sm">{acc.name}</span>
                      <span className="block text-[10px] text-muted-foreground truncate">{acc.owner_name}</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">
                      {acc.sharedRole === 'editor' ? (
                        <><Pencil className="h-2.5 w-2.5 mr-0.5" />{t('accounts.role_editor')}</>
                      ) : (
                        <><Eye className="h-2.5 w-2.5 mr-0.5" />{t('accounts.role_viewer')}</>
                      )}
                    </Badge>
                    {acc.id === activeAccount.id && (
                      <span className="text-xs text-primary">●</span>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialogOpen(true)} className="flex items-center gap-2 text-primary">
            <Plus className="h-4 w-4" />
            {t('accounts.add')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('accounts.add')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('accounts.name')}</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('accounts.name_placeholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('accounts.color')}</Label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${newColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('accounts.icon')}</Label>
              <div className="grid grid-cols-6 gap-2">
                {Object.entries(ICON_MAP).map(([key, Icon]) => (
                  <button
                    key={key}
                    onClick={() => setNewIcon(key)}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-all ${newIcon === key ? 'border-primary bg-primary/10' : 'border-border'}`}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('accounts.initial_balance')}</Label>
              <Input
                type="number"
                min="0"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                placeholder={t('accounts.initial_balance_placeholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={addAccount.isPending || !newName.trim()}>
              {t('accounts.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
