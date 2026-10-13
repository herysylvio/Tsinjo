import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Plus, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFamily } from '@/hooks/useFamily';

const CreateOrJoinFamily = () => {
  const { t } = useTranslation();
  const { createFamily, joinFamily } = useFamily();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!familyName.trim()) return;
    setError('');
    try {
      await createFamily.mutateAsync(familyName.trim());
    } catch {
      setError(t('family.error_create'));
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setError('');
    try {
      await joinFamily.mutateAsync(inviteCode.trim());
    } catch (e: any) {
      if (e.message === 'invalid_code') setError(t('family.error_invalid_code'));
      else if (e.message === 'already_member') setError(t('family.error_already_member'));
      else setError(t('family.error_join'));
    }
  };

  if (mode === 'choose') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4">
        <Users className="h-16 w-16 text-primary" />
        <h1 className="text-2xl font-bold">{t('family.title')}</h1>
        <p className="text-center text-sm text-muted-foreground max-w-sm">
          {t('family.no_family_desc')}
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button onClick={() => setMode('create')} size="lg" className="gap-2">
            <Plus className="h-4 w-4" />
            {t('family.create')}
          </Button>
          <Button onClick={() => setMode('join')} variant="outline" size="lg" className="gap-2">
            <LogIn className="h-4 w-4" />
            {t('family.join')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">
            {mode === 'create' ? t('family.create') : t('family.join')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === 'create' ? (
            <>
              <Input
                placeholder={t('family.name_placeholder')}
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <Button
                onClick={handleCreate}
                disabled={createFamily.isPending || !familyName.trim()}
                className="w-full"
              >
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
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              />
              <Button
                onClick={handleJoin}
                disabled={joinFamily.isPending || inviteCode.length < 6}
                className="w-full"
              >
                {joinFamily.isPending ? '...' : t('family.join')}
              </Button>
            </>
          )}
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <Button variant="ghost" onClick={() => { setMode('choose'); setError(''); }} className="w-full">
            {t('onboarding.back')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateOrJoinFamily;
