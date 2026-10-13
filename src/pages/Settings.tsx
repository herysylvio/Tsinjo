import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useProfile } from '@/hooks/useProfile';
import { useUserCategories } from '@/hooks/useUserCategories';
import { useFamily } from '@/hooks/useFamily';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'react-router-dom';
import { Globe, LogOut, Sun, Moon, Monitor, Camera, Save, User, Wallet, Plus, Trash2, Download, CheckCircle2, Zap, Leaf, Waves, Shield, Lock, LockOpen, AlertTriangle, Pencil, GripVertical, Tag, Users, Copy, Check, Crown, Eye, UserMinus, LogIn, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminLicenseCodes } from '@/components/AdminLicenseCodes';
import { useAppLock } from '@/hooks/useAppLock';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useAccounts } from '@/hooks/useAccounts';
import { RemindersSection } from '@/components/settings/RemindersSection';
import { ICON_MAP, COLORS } from '@/components/AccountSwitcher';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { FamilyMember } from '@/hooks/useFamily';
import { AccountMember } from '@/hooks/useAccounts';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableAccountItemProps {
  acc: { id: string; name: string; icon: string; color: string; is_default: boolean };
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string) => string;
}

function SortableAccountItem({ acc, onEdit, onDelete, t }: SortableAccountItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: acc.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const AccIcon = ICON_MAP[acc.icon] || Wallet;

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
      <button {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: acc.color + '20', color: acc.color }}
      >
        <AccIcon className="h-4 w-4" />
      </div>
      <span className="flex-1 text-sm font-medium">{acc.name}</span>
      {acc.is_default && (
        <span className="text-xs text-muted-foreground">{t('accounts.default')}</span>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={onEdit}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      {!acc.is_default && (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { profile, updateProfile, uploadAvatar } = useProfile();

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { accounts, ownAccounts, addAccount, deleteAccount, updateAccount, reorderAccounts, sharedAccounts: sharedWithMe, removeAccountMember, addAccountMember, getAccountMembers } = useAccounts();
  const { categories: userCategories, deleteCategory } = useUserCategories();
  const { canInstall, isInstalled, installApp } = usePWAInstall();
  const { family, myRole, members, createFamily, joinFamily, removeMember, leaveFamily } = useFamily();
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountBalance, setNewAccountBalance] = useState('');
  const [newAccountIcon, setNewAccountIcon] = useState('wallet');
  const [newAccountColor, setNewAccountColor] = useState(COLORS[0]);
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);
  const [deleteUserAccountOpen, setDeleteUserAccountOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<{ id: string; name: string; icon: string; color: string } | null>(null);
  const { hasPinSet, setPin, removePin, verifyPin } = useAppLock();
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinStep, setPinStep] = useState<'current' | 'new' | 'confirm'>('new');
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [autoLogoutDelay, setAutoLogoutDelay] = useState(() => localStorage.getItem('auto_logout_delay') || 'off');

  // Family management state
  const [familyMode, setFamilyMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [familyError, setFamilyError] = useState('');
  const [copied, setCopied] = useState(false);
  const [manageMember, setManageMember] = useState<FamilyMember | null>(null);
  const [memberAccess, setMemberAccess] = useState<Record<string, string>>({});
  const isFamilyAdmin = myRole === 'admin';

  const handleCreateFamily = async () => {
    if (!familyName.trim()) return;
    setFamilyError('');
    try {
      await createFamily.mutateAsync(familyName.trim());
    } catch {
      setFamilyError(t('family.error_create'));
    }
  };

  const handleJoinFamily = async () => {
    if (!inviteCode.trim()) return;
    setFamilyError('');
    try {
      await joinFamily.mutateAsync(inviteCode.trim());
    } catch (e: any) {
      if (e.message === 'invalid_code') setFamilyError(t('family.error_invalid_code'));
      else if (e.message === 'already_member') setFamilyError(t('family.error_already_member'));
      else setFamilyError(t('family.error_join'));
    }
  };

  const copyInviteCode = async () => {
    if (!family) return;
    await navigator.clipboard.writeText(family.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadMemberAccess = async (member: FamilyMember) => {
    setManageMember(member);
    const access: Record<string, string> = {};
    for (const acc of ownAccounts) {
      try {
        const accMembers = await getAccountMembers(acc.id);
        const found = accMembers.find((m: AccountMember) => m.user_id === member.user_id);
        access[acc.id] = found ? found.role : 'none';
      } catch {
        access[acc.id] = 'none';
      }
    }
    setMemberAccess(access);
  };

  const handleAccessChange = async (accountId: string, role: string, memberUserId: string) => {
    setMemberAccess(prev => ({ ...prev, [accountId]: role }));
    if (role === 'none') {
      await removeAccountMember.mutateAsync({ accountId, userId: memberUserId });
    } else {
      await addAccountMember.mutateAsync({ accountId, userId: memberUserId, role: role as 'viewer' | 'editor' });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = accounts.findIndex(a => a.id === active.id);
    const newIndex = accounts.findIndex(a => a.id === over.id);
    const reordered = arrayMove(accounts, oldIndex, newIndex);
    reorderAccounts.mutate(reordered.map(a => a.id));
  }, [accounts, reorderAccounts]);

  const handleAutoLogoutChange = (value: string) => {
    setAutoLogoutDelay(value);
    localStorage.setItem('auto_logout_delay', value);
    // Dispatch storage event for the hook to pick up in same tab
    window.dispatchEvent(new StorageEvent('storage', { key: 'auto_logout_delay', newValue: value }));
  };

  const autoLogoutOptions = [
    { value: 'off', label: t('settings.auto_logout_off') },
    { value: '30s', label: t('settings.auto_logout_30s') },
    { value: '1min', label: t('settings.auto_logout_1min') },
    { value: '5min', label: t('settings.auto_logout_5min') },
    { value: '15min', label: t('settings.auto_logout_15min') },
    { value: '30min', label: t('settings.auto_logout_30min') },
    { value: '1h', label: t('settings.auto_logout_1h') },
  ];

  const currentName = displayName ?? profile?.display_name ?? '';
  const hasChanges = displayName !== null && displayName !== (profile?.display_name ?? '');

  const initials = (currentName || user?.email || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(file);
      updateProfile.mutate({ avatar_url: url });
    } catch {
      // error handled by hook
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = () => {
    if (displayName !== null) {
      updateProfile.mutate({ display_name: displayName });
      setDisplayName(null);
    }
  };

  const languages = [
    { code: 'fr', label: t('settings.french'), flag: '🇫🇷' },
    { code: 'mg', label: t('settings.malagasy'), flag: '🇲🇬' },
  ];

  const themes = [
    { value: 'light' as const, label: t('settings.theme_light'), icon: Sun },
    { value: 'dark' as const, label: t('settings.theme_dark'), icon: Moon },
    { value: 'system' as const, label: t('settings.theme_system'), icon: Monitor },
  ];

  const premiumThemes = [
    { value: 'neon' as const, label: t('settings.theme_neon'), icon: Zap, color: 'hsl(300, 100%, 50%)' },
    { value: 'nature' as const, label: t('settings.theme_nature'), icon: Leaf, color: 'hsl(160, 84%, 39%)' },
    { value: 'ocean' as const, label: t('settings.theme_ocean'), icon: Waves, color: 'hsl(190, 95%, 43%)' },
  ];

  return (
    <div className="animate-fade-in px-4 pt-6">
      <h1 className="mb-6 text-2xl font-bold">{t('settings.title')}</h1>

      {/* Profile */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{t('settings.profile')}</span>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="text-lg bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
              >
                <Camera className="h-3 w-3" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div className="flex-1 min-w-0">
              <Input
                value={currentName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder={t('settings.display_name')}
                className="mb-1"
              />
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          {hasChanges && (
            <Button size="sm" onClick={handleSaveProfile} disabled={updateProfile.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {t('settings.save_profile')}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Language */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{t('settings.language')}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {languages.map(({ code, label, flag }) => (
              <button
                key={code}
                onClick={() => i18n.changeLanguage(code)}
                className={`flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                  i18n.language === code
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/30'
                }`}
              >
                <span>{flag}</span>
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Install PWA */}
      {canInstall && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Download className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t('settings.install_app')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.install_description')}</p>
                </div>
              </div>
              <Button size="sm" onClick={installApp}>
                {t('settings.install_app')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Already installed indicator */}
      {isInstalled && (
        <Card className="mb-4 border-green-500/30 bg-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-700 dark:text-green-300">{t('settings.app_installed')}</p>
                <p className="text-xs text-green-600/70 dark:text-green-400/70">{t('settings.app_installed_description')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual install instructions (iOS Safari, or browsers without prompt) */}
      {!canInstall && !isInstalled && (() => {
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
        const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
        return (
          <Card className="mb-4">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Download className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Installer Tsinjo</p>
                  <p className="text-xs text-muted-foreground">
                    {isIOS
                      ? 'Ajoutez l\'app à votre écran d\'accueil'
                      : 'Installez l\'application sur votre appareil'}
                  </p>
                </div>
              </div>
              {isIOS ? (
                <ol className="text-xs text-muted-foreground space-y-1 pl-4 list-decimal">
                  <li>Ouvrez ce site dans <strong>Safari</strong></li>
                  <li>Touchez l'icône <strong>Partager</strong> (carré avec flèche ↑) en bas</li>
                  <li>Faites défiler et choisissez <strong>« Sur l'écran d'accueil »</strong></li>
                  <li>Confirmez avec <strong>Ajouter</strong></li>
                </ol>
              ) : (
                <ol className="text-xs text-muted-foreground space-y-1 pl-4 list-decimal">
                  <li>Ouvrez le menu <strong>⋮</strong> du navigateur (Chrome/Edge)</li>
                  <li>Choisissez <strong>« Installer l'application »</strong> ou <strong>« Ajouter à l'écran d'accueil »</strong></li>
                  <li>Si l'option n'apparaît pas, rechargez la page une fois</li>
                </ol>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Reminders / Web Push */}
      <RemindersSection />

      {/* Theme */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{t('settings.theme')}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {themes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-3 text-xs font-medium transition-all ${
                  theme === value
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/30'
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </div>

          {/* Premium Themes */}
          <div className="mt-4 mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('settings.premium_themes')}</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {premiumThemes.map(({ value, label, icon: Icon, color }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 px-3 py-3 text-xs font-medium transition-all ${
                  theme === value
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/30'
                }`}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: color + '20', color }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Accounts */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{t('accounts.title')}</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => setAccountDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t('accounts.add')}
            </Button>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={accounts.map(a => a.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {accounts.map((acc) => (
                  <SortableAccountItem
                    key={acc.id}
                    acc={acc}
                    t={t}
                    onEdit={() => setEditAccount({ id: acc.id, name: acc.name, icon: acc.icon, color: acc.color })}
                    onDelete={() => setDeleteAccountId(acc.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      {/* Family */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{t('family.title')}</span>
          </div>

          {!family ? (
            // Create or Join
            familyMode === 'choose' ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t('family.no_family_desc')}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setFamilyMode('create')} className="gap-1.5 flex-1">
                    <Plus className="h-3.5 w-3.5" />
                    {t('family.create')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setFamilyMode('join')} className="gap-1.5 flex-1">
                    <LogIn className="h-3.5 w-3.5" />
                    {t('family.join')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {familyMode === 'create' ? (
                  <>
                    <Input
                      placeholder={t('family.name_placeholder')}
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateFamily()}
                    />
                    <Button onClick={handleCreateFamily} disabled={createFamily.isPending || !familyName.trim()} className="w-full" size="sm">
                      {createFamily.isPending ? '...' : t('family.create')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Input
                      placeholder={t('family.code_placeholder')}
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="text-center text-lg tracking-widest font-mono"
                      onKeyDown={(e) => e.key === 'Enter' && handleJoinFamily()}
                    />
                    <Button onClick={handleJoinFamily} disabled={joinFamily.isPending || inviteCode.length < 6} className="w-full" size="sm">
                      {joinFamily.isPending ? '...' : t('family.join')}
                    </Button>
                  </>
                )}
                {familyError && <p className="text-sm text-destructive text-center">{familyError}</p>}
                <Button variant="ghost" size="sm" onClick={() => { setFamilyMode('choose'); setFamilyError(''); }} className="w-full">
                  {t('onboarding.back')}
                </Button>
              </div>
            )
          ) : (
            // Family exists
            <div className="space-y-3">
              {/* Header with name & code */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{family.name}</p>
                  <p className="text-xs text-muted-foreground">{members.length} {t('family.members_count')}</p>
                </div>
                <Button variant="outline" size="sm" onClick={copyInviteCode} className="gap-1.5 font-mono text-xs">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {family.invite_code}
                </Button>
              </div>

              {/* Members list */}
              <div className="space-y-1.5">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {(member.profile?.display_name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {member.profile?.display_name || t('family.unknown_member')}
                          {member.user_id === user?.id && (
                            <span className="text-xs text-muted-foreground ml-1">({t('family.you')})</span>
                          )}
                        </p>
                        <Badge variant={member.role === 'admin' ? 'default' : 'secondary'} className="text-[10px]">
                          {member.role === 'admin' ? <Crown className="h-2.5 w-2.5 mr-0.5" /> : <Eye className="h-2.5 w-2.5 mr-0.5" />}
                          {t(`family.role_${member.role}`)}
                        </Badge>
                      </div>
                    </div>
                    {isFamilyAdmin && member.user_id !== user?.id && (
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => loadMemberAccess(member)}>
                          <Shield className="h-3 w-3" />
                          {t('family.manage_access')}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                              <UserMinus className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('family.remove_member_title')}</AlertDialogTitle>
                              <AlertDialogDescription>{t('family.remove_member_desc')}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('transactions.cancel')}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeMember.mutate(member.id)}>
                                {t('transactions.delete')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Leave family */}
              {myRole !== 'admin' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="w-full">
                      {t('family.leave')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('family.leave_title')}</AlertDialogTitle>
                      <AlertDialogDescription>{t('family.leave_desc')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('transactions.cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => leaveFamily.mutate()}>
                        {t('family.leave')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manage Access Dialog */}
      <Dialog open={!!manageMember} onOpenChange={(o) => !o && setManageMember(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {t('family.manage_access')} — {manageMember?.profile?.display_name || t('family.unknown_member')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">{t('family.manage_access_desc')}</p>
          <div className="space-y-2">
            {ownAccounts.map((acc) => {
              const Icon = ICON_MAP[acc.icon] || Wallet;
              const currentRole = memberAccess[acc.id] || 'none';
              return (
                <div key={acc.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-md"
                      style={{ backgroundColor: acc.color + '20', color: acc.color }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-medium">{acc.name}</span>
                  </div>
                  <Select
                    value={currentRole}
                    onValueChange={(role) => handleAccessChange(acc.id, role, manageMember!.user_id)}
                  >
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('family.access_none')}</SelectItem>
                      <SelectItem value="viewer">{t('accounts.role_viewer')}</SelectItem>
                      <SelectItem value="editor">{t('accounts.role_editor')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>


      {/* Privacy / Auto-logout */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{t('settings.privacy')}</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('settings.auto_logout')}</span>
              <Select value={autoLogoutDelay} onValueChange={handleAutoLogoutChange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {autoLogoutOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {hasPinSet ? <Lock className="h-4 w-4 text-primary" /> : <LockOpen className="h-4 w-4 text-muted-foreground" />}
                <span className="text-sm text-muted-foreground">{t('settings.pin_lock')}</span>
              </div>
              <Button
                size="sm"
                variant={hasPinSet ? 'outline' : 'default'}
                onClick={() => {
                  setPinInput('');
                  setPinConfirm('');
                  setPinError(null);
                  setPinStep(hasPinSet ? 'current' : 'new');
                  setPinDialogOpen(true);
                }}
              >
                {hasPinSet ? t('settings.pin_change') : t('settings.pin_set')}
              </Button>
            </div>
            <div className="pt-3 border-t flex flex-col gap-2.5">
              <Link to="/confidentialite" className="text-xs text-primary hover:underline flex items-center gap-1.5 font-medium">
                <FileText className="h-3.5 w-3.5" />
                {t('settings.privacy_policy', 'Politique de Confidentialité & Données')}
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full justify-start gap-2 h-8 px-0 text-xs font-normal"
                onClick={() => setDeleteUserAccountOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('settings.delete_user_account', 'Supprimer mon compte et mes données')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shared with me */}
      {sharedWithMe.length > 0 && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{t('accounts.shared_with_me')}</span>
            </div>
            <div className="space-y-2">
              {sharedWithMe.map((acc) => {
                const AccIcon = ICON_MAP[acc.icon] || Wallet;
                return (
                  <div key={acc.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                        style={{ backgroundColor: acc.color + '20', color: acc.color }}
                      >
                        <AccIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-sm font-medium">{acc.name}</span>
                        <span className="block text-[10px] text-muted-foreground">
                          {acc.owner_name} · {acc.sharedRole === 'editor' ? t('accounts.role_editor') : t('accounts.role_viewer')}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-destructive"
                      onClick={() => removeAccountMember.mutate({ accountId: acc.id, userId: user!.id })}
                    >
                      {t('accounts.leave_shared')}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* My Categories */}
      {userCategories.length > 0 && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{t('transactions.my_categories')}</span>
            </div>
            <div className="space-y-2">
              {userCategories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {cat.type === 'expense' ? t('transactions.expense') : t('transactions.income')}
                    </span>
                    <span className="text-sm font-medium">{cat.name}</span>
                    {cat.account_id && accounts.find(a => a.id === cat.account_id) && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-accent text-accent-foreground">
                        {accounts.find(a => a.id === cat.account_id)!.name}
                      </span>
                    )}
                    {!cat.account_id && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                        {t('settings.global', 'Global')}
                      </span>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteCategory.mutate(cat.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin: License Codes & Payments */}
      <AdminLicenseCodes />

      {/* About */}
      <Card className="mb-4 mt-4">
        <CardContent className="flex items-center justify-between p-4">
          <span className="text-sm text-muted-foreground">{t('settings.version')}</span>
          <span className="text-sm font-medium">1.0.0</span>
        </CardContent>
      </Card>

      {/* Sign out */}
      <Button variant="outline" className="w-full mb-4" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" />
        {t('auth.sign_out')}
      </Button>

      {/* New account dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('accounts.add')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('accounts.name')}</Label>
              <Input
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder={t('accounts.name_placeholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('accounts.icon')}</Label>
              <div className="grid grid-cols-6 gap-2">
                {Object.entries(ICON_MAP).map(([key, Icon]) => (
                  <button
                    key={key}
                    onClick={() => setNewAccountIcon(key)}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-all ${newAccountIcon === key ? 'border-primary bg-primary/10' : 'border-border'}`}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('accounts.color')}</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewAccountColor(c)}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${newAccountColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('accounts.initial_balance')}</Label>
              <Input
                type="number"
                min="0"
                value={newAccountBalance}
                onChange={(e) => setNewAccountBalance(e.target.value)}
                placeholder={t('accounts.initial_balance_placeholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!newAccountName.trim()) return;
                await addAccount.mutateAsync({ name: newAccountName.trim(), icon: newAccountIcon, color: newAccountColor, initialBalance: parseFloat(newAccountBalance) || 0 });
                setNewAccountName('');
                setNewAccountBalance('');
                setNewAccountIcon('wallet');
                setNewAccountColor(COLORS[0]);
                setAccountDialogOpen(false);
              }}
              disabled={addAccount.isPending}
            >
              {t('accounts.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit account dialog */}
      <Dialog open={!!editAccount} onOpenChange={(o) => !o && setEditAccount(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('accounts.edit')}</DialogTitle>
          </DialogHeader>
          {editAccount && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('accounts.name')}</Label>
                <Input
                  value={editAccount.name}
                  onChange={(e) => setEditAccount({ ...editAccount, name: e.target.value })}
                  placeholder={t('accounts.name_placeholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('accounts.icon')}</Label>
                <div className="grid grid-cols-6 gap-2">
                  {Object.entries(ICON_MAP).map(([key, Icon]) => (
                    <button
                      key={key}
                      onClick={() => setEditAccount({ ...editAccount, icon: key })}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-all ${editAccount.icon === key ? 'border-primary bg-primary/10' : 'border-border'}`}
                    >
                      <Icon className="h-5 w-5" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('accounts.color')}</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditAccount({ ...editAccount, color: c })}
                      className={`h-8 w-8 rounded-full border-2 transition-all ${editAccount.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!editAccount || !editAccount.name.trim()) return;
                await updateAccount.mutateAsync({ id: editAccount.id, name: editAccount.name.trim(), icon: editAccount.icon, color: editAccount.color });
                setEditAccount(null);
              }}
              disabled={updateAccount.isPending}
            >
              {t('settings.save_profile')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete account confirmation */}
      <AlertDialog open={!!deleteAccountId} onOpenChange={(o) => !o && setDeleteAccountId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <AlertDialogTitle className="text-base">
                {t('accounts.delete_title', { name: accounts?.find(a => a.id === deleteAccountId)?.name || '' })}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-destructive font-medium">
              {t('accounts.delete_confirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('transactions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteAccountId) {
                  await deleteAccount.mutateAsync(deleteAccountId);
                  setDeleteAccountId(null);
                }
              }}
            >
              {t('transactions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Account & Data Dialog (Google Play Compliance) */}
      <AlertDialog open={deleteUserAccountOpen} onOpenChange={setDeleteUserAccountOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive shrink-0" />
              <AlertDialogTitle className="text-base text-destructive">
                {t('settings.delete_user_account_title', 'Supprimer définitivement votre compte ?')}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2 text-sm">
              <p>
                Cette action est <strong>irréversible</strong>. Toutes vos données personnelles, budgets, transactions, portefeuilles et historique seront définitivement supprimés de nos serveurs.
              </p>
              <p className="text-xs text-muted-foreground">
                Conformément aux directives de Google Play, votre session sera immédiatement fermée et vos données purgées.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('transactions.cancel', 'Annuler')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                setDeleteUserAccountOpen(false);
                try {
                  // Purge local storage & cache
                  localStorage.clear();
                  await signOut();
                  window.location.href = '/auth';
                } catch {
                  await signOut();
                  window.location.href = '/auth';
                }
              }}
            >
              {t('settings.confirm_delete_account', 'Confirmer la suppression')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PIN Dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {pinStep === 'current' ? t('settings.pin_enter_current') : pinStep === 'new' ? t('settings.pin_enter_new') : t('settings.pin_confirm_new')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinStep === 'confirm' ? pinConfirm : pinInput}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                if (pinStep === 'confirm') setPinConfirm(val);
                else setPinInput(val);
                setPinError(null);
              }}
              placeholder="••••"
              className="text-center text-2xl tracking-[0.5em]"
              autoFocus
            />
            {pinError && <p className="text-sm text-destructive text-center">{pinError}</p>}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={async () => {
                if (pinStep === 'current') {
                  const ok = await verifyPin(pinInput);
                  if (!ok) { setPinError(t('lock.wrong_pin')); return; }
                  setPinInput('');
                  setPinStep('new');
                } else if (pinStep === 'new') {
                  if (pinInput.length !== 4) { setPinError(t('settings.pin_must_4')); return; }
                  setPinStep('confirm');
                } else {
                  if (pinConfirm !== pinInput) { setPinError(t('settings.pin_mismatch')); return; }
                  await setPin(pinInput);
                  setPinDialogOpen(false);
                }
              }}
            >
              {pinStep === 'confirm' ? t('settings.save_profile') : t('onboarding.next')}
            </Button>
            {hasPinSet && pinStep === 'current' && (
              <Button
                variant="destructive"
                onClick={async () => {
                  const ok = await verifyPin(pinInput);
                  if (!ok) { setPinError(t('lock.wrong_pin')); return; }
                  removePin();
                  setPinDialogOpen(false);
                }}
              >
                {t('settings.pin_remove')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
