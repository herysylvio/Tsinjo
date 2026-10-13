import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ReminderType =
  | "daily_entry"
  | "recurring_due"
  | "weekly_recap"
  | "inactivity";

export interface Reminder {
  id: string;
  user_id: string;
  type: ReminderType;
  enabled: boolean;
  time: string;
  timezone: string;
  quiet_start: string;
  quiet_end: string;
  last_sent_at: string | null;
}

export function useReminders() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["user_reminders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_reminders")
        .select("*")
        .order("type");
      if (error) throw error;
      return data as Reminder[];
    },
    enabled: !!user,
  });

  const update = useMutation({
    mutationFn: async (
      payload: Partial<Reminder> & { id: string },
    ) => {
      const { id, ...rest } = payload;
      const { error } = await supabase
        .from("user_reminders")
        .update(rest)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_reminders"] });
    },
  });

  return {
    reminders: query.data ?? [],
    isLoading: query.isLoading,
    update: update.mutate,
    isUpdating: update.isPending,
  };
}
