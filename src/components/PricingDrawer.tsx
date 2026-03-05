/**
 * PricingDrawer Component
 *
 * Shown when a user with 0 credits attempts to download.
 * Offers subscription (via SubscriptionDrawer) and placeholder for credit packs (Epic 5).
 */

import { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { MotionButton, buttonAnimations } from '@/components/ui/motion-button';
import { SubscriptionDrawer } from './SubscriptionDrawer';
import { Crown, Coins } from 'lucide-react';

interface PricingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PricingDrawer({ open, onOpenChange }: PricingDrawerProps) {
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="text-center pb-2">
            <DrawerTitle className="text-lg font-semibold">You're out of credits</DrawerTitle>
            <DrawerDescription>
              Get more credits to continue downloading clips
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-6 pb-8 space-y-3">
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

            {/* Credit packs placeholder */}
            <MotionButton
              variant="outline"
              className="w-full h-12"
              disabled
              {...buttonAnimations.press}
            >
              <Coins className="mr-2 h-5 w-5" />
              Credit packs — coming soon
            </MotionButton>

            {/* Dismiss */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              Maybe later
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      <SubscriptionDrawer
        open={subscriptionOpen}
        onOpenChange={setSubscriptionOpen}
      />
    </>
  );
}
