/**
 * Age Gate Hook
 *
 * Thin wrapper around the Zustand preferences store.
 * Returns confirmation status, pending state, and confirm/deny functions.
 */

import { useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { usePreferencesStore } from '@/stores/usePreferencesStore';

export function useAgeGate() {
  const isConfirmed = usePreferencesStore((s) => s.ageGateConfirmed);
  const confirmAction = usePreferencesStore((s) => s.ageGateConfirm);
  const navigate = useNavigate();

  const isPending = !isConfirmed;

  const deny = useCallback(() => {
    navigate({ to: '/age-restricted' });
  }, [navigate]);

  return { isConfirmed, isPending, confirm: confirmAction, deny } as const;
}
