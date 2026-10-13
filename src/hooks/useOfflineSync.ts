import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getSyncQueue, removeSyncItem, type SyncOperation } from '@/lib/offlineDb';
import { useNetworkStatus } from './useNetworkStatus';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

const processOperation = async (op: SyncOperation) => {
  const { table, type, payload } = op;
  
  switch (type) {
    case 'insert': {
      const { _offline_id, ...insertData } = payload;
      const { error } = await (supabase.from as any)(table).insert(insertData);
      if (error) throw error;
      break;
    }
    case 'update': {
      const { id, ...updateData } = payload;
      const { error } = await (supabase.from as any)(table).update(updateData).eq('id', id);
      if (error) throw error;
      break;
    }
    case 'delete': {
      const { error } = await (supabase.from as any)(table).delete().eq('id', payload.id);
      if (error) throw error;
      break;
    }
  }
};

export const useOfflineSync = () => {
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const syncingRef = useRef(false);

  const syncNow = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;

    try {
      const queue = await getSyncQueue();
      if (queue.length === 0) return;

      let synced = 0;
      let failed = 0;

      for (const op of queue) {
        try {
          await processOperation(op);
          await removeSyncItem(op.id);
          synced++;
        } catch (err) {
          console.error('Sync failed for operation:', op, err);
          failed++;
        }
      }

      if (synced > 0) {
        // Invalidate all relevant queries
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['balance'] });
        queryClient.invalidateQueries({ queryKey: ['global-balance'] });
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
        queryClient.invalidateQueries({ queryKey: ['personal_budgets'] });
        queryClient.invalidateQueries({ queryKey: ['savings_goals'] });

        toast({
          title: '✅ Synchronisation terminée',
          description: `${synced} opération${synced > 1 ? 's' : ''} synchronisée${synced > 1 ? 's' : ''}${failed > 0 ? `, ${failed} échouée${failed > 1 ? 's' : ''}` : ''}`,
        });
      }
    } finally {
      syncingRef.current = false;
    }
  }, [queryClient]);

  // Sync when coming back online
  useEffect(() => {
    if (isOnline) {
      syncNow();
    }
  }, [isOnline, syncNow]);

  return { syncNow, isOnline };
};
