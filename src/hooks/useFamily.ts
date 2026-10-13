import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export interface Family {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: 'admin' | 'member' | 'viewer';
  joined_at: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface FamilyBudget {
  id: string;
  family_id: string;
  category: string;
  amount: number;
  period: string;
  created_at: string;
}

export interface FamilyTransaction {
  id: string;
  user_id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string | null;
  transaction_date: string;
  created_at: string;
  member_name?: string;
}

export const useFamily = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Get current user's family membership
  const membershipQuery = useQuery({
    queryKey: ['family-membership', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('family_members')
        .select('*, families(*)')
        .eq('user_id', user!.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as (FamilyMember & { families: Family }) | null;
    },
    enabled: !!user,
  });

  const family = membershipQuery.data?.families ?? null;
  const myRole = membershipQuery.data?.role ?? null;
  const familyId = family?.id;

  // Get family members with profiles
  const membersQuery = useQuery({
    queryKey: ['family-members', familyId],
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('family_id', familyId!);
      if (error) throw error;

      // Fetch profiles for each member
      const userIds = (members || []).map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      
      return (members || []).map((m: any) => ({
        ...m,
        profile: profileMap.get(m.user_id) || { display_name: null, avatar_url: null },
      })) as FamilyMember[];
    },
    enabled: !!familyId,
  });

  // Get family budgets
  const budgetsQuery = useQuery({
    queryKey: ['family-budgets', familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('family_budgets')
        .select('*')
        .eq('family_id', familyId!);
      if (error) throw error;
      return (data || []) as FamilyBudget[];
    },
    enabled: !!familyId,
  });

  // Create family
  const createFamily = useMutation({
    mutationFn: async (name: string) => {
      const { data: familyId, error } = await supabase
        .rpc('create_family_with_admin', { _name: name, _user_id: user!.id });
      if (error) throw error;
      return { id: familyId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-membership'] });
      toast({ title: t('family.created') });
    },
  });

  // Join family by invite code
  const joinFamily = useMutation({
    mutationFn: async (inviteCode: string) => {
      const { data: familyId, error: rpcErr } = await supabase
        .rpc('get_family_id_by_invite_code', { _code: inviteCode.trim() });
      if (rpcErr) throw rpcErr;
      if (!familyId) throw new Error('invalid_code');

      const { error: memErr } = await supabase
        .from('family_members')
        .insert({ family_id: familyId, user_id: user!.id, role: 'member' });
      if (memErr) {
        if (memErr.code === '23505') throw new Error('already_member');
        throw memErr;
      }
      return { id: familyId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-membership'] });
      toast({ title: t('family.joined') });
    },
  });


  // Remove member
  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('family_members')
        .delete()
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-members'] });
      queryClient.invalidateQueries({ queryKey: ['family-membership'] });
    },
  });

  // Leave family
  const leaveFamily = useMutation({
    mutationFn: async () => {
      if (!membershipQuery.data) return;
      const { error } = await supabase
        .from('family_members')
        .delete()
        .eq('id', membershipQuery.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-membership'] });
      queryClient.invalidateQueries({ queryKey: ['family-members'] });
      toast({ title: t('family.left') });
    },
  });

  // Add/update budget
  const upsertBudget = useMutation({
    mutationFn: async ({ category, amount }: { category: string; amount: number }) => {
      const { error } = await supabase
        .from('family_budgets')
        .upsert(
          { family_id: familyId!, category, amount },
          { onConflict: 'family_id,category' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-budgets'] });
    },
  });

  // Delete budget
  const deleteBudget = useMutation({
    mutationFn: async (budgetId: string) => {
      const { error } = await supabase
        .from('family_budgets')
        .delete()
        .eq('id', budgetId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-budgets'] });
    },
  });

  // Realtime subscriptions
  useEffect(() => {
    if (!familyId) return;

    const channelName = `family-${familyId}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const channel = supabase.channel(channelName);

    // Register all listeners BEFORE subscribe()
    channel.on(
      'postgres_changes' as any,
      {
        event: '*',
        schema: 'public',
        table: 'family_members',
        filter: `family_id=eq.${familyId}`,
      },
      () => {
        queryClient.invalidateQueries({ queryKey: ['family-members', familyId] });
      },
    );
    channel.on(
      'postgres_changes' as any,
      {
        event: '*',
        schema: 'public',
        table: 'family_budgets',
        filter: `family_id=eq.${familyId}`,
      },
      () => {
        queryClient.invalidateQueries({ queryKey: ['family-budgets', familyId] });
      },
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyId, queryClient]);

  return {
    family,
    myRole,
    isLoading: membershipQuery.isLoading,
    isError: membershipQuery.isError,
    members: membersQuery.data ?? [],
    membersLoading: membersQuery.isLoading,
    budgets: budgetsQuery.data ?? [],
    createFamily,
    joinFamily,
    removeMember,
    leaveFamily,
    upsertBudget,
    deleteBudget,
  };
};
