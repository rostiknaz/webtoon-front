/**
 * Feed Route — /feed
 *
 * Redirects to / (feed is now the homepage).
 * Kept for backwards compatibility.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/feed')({
  beforeLoad: () => {
    throw redirect({ to: '/' });
  },
});
