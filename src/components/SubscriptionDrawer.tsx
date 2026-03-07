import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { MotionButton, buttonAnimations } from '@/components/ui/motion-button';
import { Crown, Check, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { getSubscriptionPlans, subscribeToPlan } from '@/api';
import { formatPrice } from '@/lib/format';
import type { Plan } from '@/types';

function getFeaturesList(features: Plan['features']) {
  const list = [];
  if (features.episodeAccess === 'all') list.push('Unlimited access to all episodes');
  if (features.adFree) list.push('Ad-free viewing experience');
  if (features.downloadable) list.push('Download episodes for offline viewing');
  if (features.earlyAccess) list.push('Early access to new episodes');
  return list;
}

interface SubscriptionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clipId?: string;
}

export function SubscriptionDrawer({ open, onOpenChange, clipId }: SubscriptionDrawerProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Fetch subscription plans using React Query
  const {
    data: plansData,
    isLoading: isLoadingPlans,
    error: plansError,
  } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: getSubscriptionPlans,
    enabled: open, // Only fetch when drawer is open
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days - plans rarely change
    gcTime: 7 * 24 * 60 * 60 * 1000, // Keep in cache for 7 days
    retry: 1,
  });

  // Subscribe mutation — redirects to Solidgate payment page
  const subscribeMutation = useMutation({
    mutationFn: (planId: string) => subscribeToPlan(planId, clipId),
    onSuccess: ({ paymentUrl }) => {
      window.location.assign(paymentUrl);
    },
    onError: (error: Error) => {
      toast.error('Subscription Failed', {
        description: error.message,
      });
    },
  });

  const plans = plansData?.plans || [];

  // Auto-select recommended plan (monthly) when plans load
  useEffect(() => {
    if (plans.length > 0 && !selectedPlan) {
      const recommendedPlan = plans.find((p) => p.billingPeriod === 'monthly');
      if (recommendedPlan) {
        setSelectedPlan(recommendedPlan.id);
      }
    }
  }, [plans, selectedPlan]);

  const handleSubscribe = () => {
    if (!selectedPlan) {
      toast.error('Please select a plan');
      return;
    }

    subscribeMutation.mutate(selectedPlan);
  };

  // Memoize derived data to prevent O(n) recalculation on every render
  const { selectedPlanData, recommendedPlanId, plansWithFeatures } = useMemo(() => {
    const recommended = plans.find(p => p.billingPeriod === 'monthly')?.id;
    const selected = plans.find(p => p.id === selectedPlan);
    const withFeatures = plans.map(plan => ({
      ...plan,
      featureList: getFeaturesList(plan.features),
    }));

    return {
      selectedPlanData: selected,
      recommendedPlanId: recommended,
      plansWithFeatures: withFeatures,
    };
  }, [plans, selectedPlan]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh] flex flex-col" aria-describedby="subscription-description">
        <DrawerHeader className="text-center pb-4">
          <DrawerTitle className="text-2xl font-bold flex items-center justify-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" />
            Choose Your Plan
          </DrawerTitle>
          <DrawerDescription id="subscription-description" className="text-muted-foreground">
            Unlock all premium episodes and enjoy an ad-free experience
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {plansError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm mb-4">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{plansError instanceof Error ? plansError.message : 'Failed to load subscription plans'}</span>
            </div>
          )}

          {isLoadingPlans ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4 max-w-2xl mx-auto">
              {plansWithFeatures.map((plan) => {
                const isSelected = selectedPlan === plan.id;
                const isRecommended = plan.id === recommendedPlanId;

                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan.id)}
                    aria-pressed={isSelected}
                    aria-label={`Select ${plan.name} plan - ${formatPrice(plan.price, plan.currency)}${plan.trialDays > 0 ? `, ${plan.trialDays}-day free trial` : ''}`}
                    className={`relative w-full text-left border-2 rounded-lg p-6 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {isRecommended && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                          <Sparkles className="h-3 w-3" aria-hidden="true" />
                          RECOMMENDED
                        </span>
                      </div>
                    )}

                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                        <p className="text-sm text-muted-foreground">{plan.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold">
                          {formatPrice(plan.price, plan.currency)}
                        </div>
                        {plan.trialDays > 0 && (
                          <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mt-1">
                            {plan.trialDays}-day free trial
                          </div>
                        )}
                      </div>
                    </div>

                    <ul className="space-y-2 mb-4">
                      {plan.featureList.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}

              <MotionButton
                onClick={handleSubscribe}
                disabled={subscribeMutation.isPending || !selectedPlan}
                className="w-full h-12 text-base font-medium mt-6"
                size="lg"
                {...buttonAnimations.hoverPress}
              >
                {subscribeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Crown className="mr-2 h-5 w-5" />
                    Start My {selectedPlanData?.trialDays ? 'Free Trial' : 'Subscription'}
                  </>
                )}
              </MotionButton>

              <p className="text-center text-xs text-muted-foreground mt-4">
                {selectedPlanData?.trialDays
                  ? `Start your free trial today. Cancel anytime during the trial period.`
                  : `Your subscription will start immediately. Cancel anytime from your account settings.`}
              </p>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
