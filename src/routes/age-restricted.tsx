/**
 * Age Restricted Route — /age-restricted
 *
 * Landing page for users who denied being 18+.
 * No feed access. Must clear localStorage manually to return.
 */

import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/age-restricted')({
  component: AgeRestrictedPage,
});

function AgeRestrictedPage() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[hsl(240_10%_4%)] px-6">
      <div className="text-center max-w-[380px]">
        <h1 className="text-[24px] font-bold text-white/90 tracking-[-0.02em] font-display mb-4">
          Age Restricted Content
        </h1>
        <p className="text-[14px] text-white/45 leading-relaxed mb-6">
          This platform contains content intended for adults only.
          You must be at least 18 years old to access this site.
        </p>
        <p className="text-[12px] text-white/20 leading-relaxed">
          If you believe this is an error, clear your browser data and try again.
        </p>
      </div>
    </div>
  );
}
