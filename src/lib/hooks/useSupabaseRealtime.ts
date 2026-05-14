'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type RealtimeTable = {
  table: string;
  filter?: string;
};

export function useSupabaseRealtime(channelName: string, tables: RealtimeTable[], onChange: () => void) {
  useEffect(() => {
    if (tables.length === 0) return undefined;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(onChange, 350);
    };

    let channel = supabase.channel(channelName);
    tables.forEach((entry) => {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: entry.table,
          ...(entry.filter ? { filter: entry.filter } : {}),
        },
        scheduleRefresh,
      );
    });

    channel.subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [channelName, onChange, tables]);
}
