/**
 * Account Page
 *
 * Displays user profile, subscription status, and linked OAuth accounts.
 * Protected route - requires authentication.
 */

import { useState } from 'react';
import { useLoaderData } from '@tanstack/react-router';
import { getInitials } from '@/lib/utils';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MotionButton, buttonAnimations } from '@/components/ui/motion-button';
import { useSubscription } from '@/hooks/useSubscription';
import { useLinkedAccounts } from '@/hooks/useLinkedAccounts';
import { SubscriptionDrawer } from '@/components/SubscriptionDrawer';
import {
  User,
  Mail,
  Calendar,
  CreditCard,
  Link as LinkIcon,
  Coins,
  Crown,
  Shield,
  Github,
} from 'lucide-react';
import { GoogleIcon } from '@/components/icons';
import type { ReactNode } from 'react';

// Provider display info with React components for icons
const PROVIDER_INFO: Record<string, { name: string; icon: ReactNode; color: string }> = {
  google: { name: 'Google', icon: <GoogleIcon className="h-5 w-5" />, color: 'bg-blue-500/10' },
  github: { name: 'GitHub', icon: <Github className="h-5 w-5" />, color: 'bg-gray-500/10 text-gray-400' },
  discord: { name: 'Discord', icon: '🟣', color: 'bg-indigo-500/10 text-indigo-500' },
  twitter: { name: 'Twitter', icon: '🐦', color: 'bg-sky-500/10 text-sky-500' },
  credential: { name: 'Email', icon: <Mail className="h-5 w-5" />, color: 'bg-green-500/10 text-green-500' },
};

const AccountPage = () => {
  // Get session from route loader
  const { session } = useLoaderData({ from: '/account' });
  const user = session.user;

  const { data: subscription } = useSubscription();
  // Use React Query-based hook for linked accounts (prevents duplicate API calls)
  const { data: linkedAccounts = [], isPending: isLoadingAccounts } = useLinkedAccounts(true);
  const [isSubscriptionDrawerOpen, setIsSubscriptionDrawerOpen] = useState(false);

  // Format date
  const formatDate = (date: Date | number | null | undefined) => {
    if (!date) return 'N/A';
    const d = typeof date === 'number' ? new Date(date * 1000) : new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Subscription status display
  const getSubscriptionStatus = () => {
    if (!subscription.hasSubscription) {
      return { label: 'Free', variant: 'secondary' as const, color: 'text-muted-foreground' };
    }
    return { label: 'Premium', variant: 'default' as const, color: 'text-primary' };
  };

  const subscriptionStatus = getSubscriptionStatus();

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-24">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">My Account</h1>
            <p className="text-muted-foreground mt-2">
              Manage your profile and subscription settings
            </p>
          </div>

          {/* Profile Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user.image || undefined} alt={user.name || 'User'} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                    {getInitials(user.name, user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-2xl">{user.name || 'User'}</CardTitle>
                    <Badge variant={subscriptionStatus.variant}>
                      <Crown className="h-3 w-3 mr-1" />
                      {subscriptionStatus.label}
                    </Badge>
                  </div>
                  <CardDescription className="mt-1">{user.email}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Name:</span>
                  <span>{user.name || 'Not set'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Email:</span>
                  <span>{user.email}</span>
                  {user.emailVerified && (
                    <Shield className="h-4 w-4 text-green-500" aria-label="Verified" />
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Member since:</span>
                  <span>{formatDate(user.createdAt)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Subscription
                  </CardTitle>
                  <CardDescription>Your current subscription plan and status</CardDescription>
                </div>
                {!subscription.hasSubscription && (
                  <MotionButton
                    onClick={() => setIsSubscriptionDrawerOpen(true)}
                    {...buttonAnimations.hoverPress}
                  >
                    Upgrade to Premium
                  </MotionButton>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {subscription.hasSubscription ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-3">
                      <Crown className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-semibold text-primary">Premium Plan</p>
                        <p className="text-sm text-muted-foreground">
                          Plan ID: {subscription.planId || 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Valid until:</span>
                    <span>{formatDate(subscription.expiresAt)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Crown className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground mb-2">
                    You're currently on the free plan
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Upgrade to Premium for unlimited access to all episodes
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Coins Balance Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Coins Balance
              </CardTitle>
              <CardDescription>Use coins to unlock individual episodes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-yellow-500/5 rounded-lg border border-yellow-500/20">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <Coins className="h-6 w-6 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">0</p>
                    <p className="text-sm text-muted-foreground">Available coins</p>
                  </div>
                </div>
                <MotionButton variant="outline" disabled {...buttonAnimations.press}>
                  Buy Coins
                </MotionButton>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Coin purchases coming soon
              </p>
            </CardContent>
          </Card>

          {/* Linked Accounts Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Linked Accounts
              </CardTitle>
              <CardDescription>
                Social accounts connected to your profile
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAccounts ? (
                <div className="space-y-3">
                  <div className="h-14 bg-muted animate-pulse rounded-lg" />
                  <div className="h-14 bg-muted animate-pulse rounded-lg" />
                </div>
              ) : linkedAccounts.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">
                  No linked accounts found
                </p>
              ) : (
                <div className="space-y-3">
                  {linkedAccounts.map((account) => {
                    const providerInfo = PROVIDER_INFO[account.provider] || {
                      name: account.provider,
                      icon: '🔗',
                      color: 'bg-gray-500/10 text-gray-500',
                    };
                    return (
                      <div
                        key={account.id}
                        className="flex items-center justify-between p-4 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-10 w-10 rounded-full flex items-center justify-center text-lg ${providerInfo.color}`}
                          >
                            {providerInfo.icon}
                          </div>
                          <div>
                            <p className="font-medium">{providerInfo.name}</p>
                            {account.createdAt && (
                              <p className="text-xs text-muted-foreground">
                                Connected {formatDate(account.createdAt)}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline">Connected</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />

      {/* Subscription Drawer */}
      <SubscriptionDrawer
        open={isSubscriptionDrawerOpen}
        onOpenChange={setIsSubscriptionDrawerOpen}
      />
    </div>
  );
};

export default AccountPage;
