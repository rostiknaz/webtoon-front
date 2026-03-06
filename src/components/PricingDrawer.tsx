/**
 * PricingDrawer Component
 *
 * Shown when a user with 0 credits attempts to download.
 * Offers subscription (via SubscriptionDrawer) and credit pack purchase options.
 * Uses animated Radix Dialog instead of drawer.
 */

import { useState } from 'react';
import {
  AnimatedDialog,
  AnimatedDialogContent,
  AnimatedDialogHeader,
  AnimatedDialogTitle,
  AnimatedDialogDescription,
} from '@/components/ui/animated-dialog';
import { MotionButton, buttonAnimations } from '@/components/ui/motion-button';
import { SubscriptionDrawer } from './SubscriptionDrawer';
import { purchaseCreditPack } from '@/api';
import { Crown, Coins, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Client-side credit pack display data.
 * Prices must match worker/lib/credit-packs.ts (source of truth for validation).
 */
const CREDIT_PACKS = [
  { id: 'pack_10', credits: 10, price: 699 },
  { id: 'pack_30', credits: 30, price: 1499 },
] as const;

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function perCreditPrice(pack: (typeof CREDIT_PACKS)[number]): string {
  return formatPrice(Math.round(pack.price / pack.credits));
}

interface PricingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clipId?: string;
}

export function PricingDrawer({ open, onOpenChange, clipId }: PricingDrawerProps) {
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [loadingPackId, setLoadingPackId] = useState<string | null>(null);

  const handlePackPurchase = async (packId: string) => {
    setLoadingPackId(packId);
    try {
      const { paymentUrl } = await purchaseCreditPack(packId, clipId);
      window.location.assign(paymentUrl);
    } catch {
      toast.error('Failed to start purchase. Please try again.');
      setLoadingPackId(null);
    }
  };

  return (
    <>
      <AnimatedDialog open={open} onOpenChange={onOpenChange}>
        <AnimatedDialogContent open={open}>
          <AnimatedDialogHeader className="pb-2">
            <AnimatedDialogTitle>You're out of credits</AnimatedDialogTitle>
            <AnimatedDialogDescription>
              Get more credits to continue downloading clips
            </AnimatedDialogDescription>
          </AnimatedDialogHeader>

          <div className="space-y-3 pt-2">
            {/* Subscription option */}
            <MotionButton
              className="w-full h-12"
              onClick={() => {
                onOpenChange(false);
                setSubscriptionOpen(true);
              }}
              {...buttonAnimations.hoverPress}
            >
              <Crown className="mr-2 h-5 w-5" />
              Subscribe for unlimited downloads
            </MotionButton>

            {/* Credit pack options */}
            {CREDIT_PACKS.map((pack) => {
              const isLoading = loadingPackId === pack.id;
              return (
                <MotionButton
                  key={pack.id}
                  variant="outline"
                  className="w-full h-12 justify-between"
                  disabled={loadingPackId !== null}
                  onClick={() => handlePackPurchase(pack.id)}
                  {...buttonAnimations.press}
                >
                  <span className="flex items-center">
                    {isLoading ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <Coins className="mr-2 h-5 w-5" />
                    )}
                    {pack.credits} Credits — {formatPrice(pack.price)}
                  </span>
                  <span className="text-xs text-muted-foreground">{perCreditPrice(pack)}/credit</span>
                </MotionButton>
              );
            })}

            {/* Dismiss */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2 cursor-pointer"
            >
              Maybe later
            </button>
          </div>
        </AnimatedDialogContent>
      </AnimatedDialog>

      <SubscriptionDrawer
        open={subscriptionOpen}
        onOpenChange={setSubscriptionOpen}
      />
    </>
  );
}
