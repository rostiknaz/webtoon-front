/**
 * Profile Page
 *
 * Unified profile & account page accessible from bottom nav / sidebar.
 * - Authenticated: avatar, name, email, credits, subscription, linked accounts, logout
 * - Anonymous: prompt to log in or sign up via AuthDrawer
 *
 * Navigation is provided by AppShell (sidebar on desktop, bottom nav on mobile).
 */

import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { authClient } from '@/lib/auth.client';
import { useOptimizedSession, useInvalidateSession } from '@/hooks/useOptimizedSession';
import { useCredits } from '@/hooks/useCredits';
import { useSubscription } from '@/hooks/useSubscription';
import { useLinkedAccounts } from '@/hooks/useLinkedAccounts';
import { AuthDrawer } from '@/components/AuthDrawer';
import { SubscriptionDrawer } from '@/components/SubscriptionDrawer';
import { DownloadHistory } from '@/components/DownloadHistory';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MotionButton, buttonAnimations } from '@/components/ui/motion-button';
import { getInitials } from '@/lib/utils';
import { GoogleIcon } from '@/components/icons';
import {
  User,
  LogOut,
  Coins,
  Crown,
  Download,
  Mail,
  Shield,
  Github,
  Link as LinkIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

const FADE_TRANSITION = { duration: 0.2 };
const FADE_VARIANTS = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const PROVIDER_INFO: Record<string, { name: string; icon: ReactNode; color: string }> = {
  google: { name: 'Google', icon: <GoogleIcon className="h-5 w-5" />, color: 'bg-blue-500/10' },
  github: { name: 'GitHub', icon: <Github className="h-5 w-5" />, color: 'bg-gray-500/10 text-gray-400' },
  discord: { name: 'Discord', icon: '🟣', color: 'bg-indigo-500/10 text-indigo-500' },
  twitter: { name: 'Twitter', icon: '🐦', color: 'bg-sky-500/10 text-sky-500' },
  credential: { name: 'Email', icon: <Mail className="h-5 w-5" />, color: 'bg-green-500/10 text-green-500' },
};

const formatDate = (date: Date | number | null | undefined) => {
  if (!date) return 'N/A';
  const d = typeof date === 'number' ? new Date(date * 1000) : new Date(date);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

function AuthenticatedProfile() {
  const { data: session } = useOptimizedSession();
  const invalidateSession = useInvalidateSession();
  const navigate = useNavigate();
  const { balance, freeDownloads } = useCredits();
  const { data: subscription } = useSubscription();
  const { data: linkedAccounts = [], isPending: isLoadingAccounts } = useLinkedAccounts(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSubscriptionDrawerOpen, setIsSubscriptionDrawerOpen] = useState(false);

  const user = session?.user;
  if (!user) return null;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            invalidateSession();
            toast.success('Logged out successfully');
            navigate({ to: '/' });
          },
          onError: (ctx) => {
            toast.error(ctx.error.message ?? 'Logout failed');
          },
        },
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* User info */}
      <div className="flex flex-col items-center text-center pt-2 pb-4">
        <Avatar className="h-20 w-20 mb-3">
          <AvatarImage src={user.image || undefined} alt={user.name || 'User'} />
          <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
            {getInitials(user.name, user.email)}
          </AvatarFallback>
        </Avatar>
        <h2 className="text-lg font-semibold">{user.name || 'User'}</h2>
        <p className="text-sm text-muted-foreground">{user.email}</p>
        {user.emailVerified && (
          <div className="flex items-center gap-1 text-xs text-green-500 mt-1">
            <Shield className="h-3 w-3" />
            <span>Verified</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Member since {formatDate(user.createdAt)}
        </p>
      </div>

      {/* Credits */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Coins className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Credits</p>
                <p className="text-xs text-muted-foreground">
                  {balance} credits · {freeDownloads} free downloads
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-primary">
              <Download className="h-4 w-4" />
              <span className="text-sm font-semibold tabular-nums">{balance + freeDownloads}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* My Downloads */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-3">
            <Download className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">My Downloads</p>
          </div>
          <DownloadHistory />
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                subscription.hasSubscription ? 'bg-primary/10' : 'bg-muted'
              }`}>
                <Crown className={`h-5 w-5 ${
                  subscription.hasSubscription ? 'text-primary' : 'text-muted-foreground'
                }`} />
              </div>
              <div>
                <p className="text-sm font-medium">Subscription</p>
                <p className="text-xs text-muted-foreground">
                  {subscription.hasSubscription
                    ? `Premium · expires ${formatDate(subscription.expiresAt)}`
                    : 'Free tier'}
                </p>
              </div>
            </div>
            {subscription.hasSubscription ? (
              <Badge variant="default">Active</Badge>
            ) : (
              <MotionButton
                size="sm"
                variant="outline"
                onClick={() => setIsSubscriptionDrawerOpen(true)}
                {...buttonAnimations.press}
              >
                Upgrade
              </MotionButton>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Linked Accounts */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-3">
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Linked Accounts</p>
          </div>
          {isLoadingAccounts ? (
            <div className="space-y-2">
              <div className="h-10 bg-muted animate-pulse rounded-lg" />
            </div>
          ) : linkedAccounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No linked accounts</p>
          ) : (
            <div className="space-y-2">
              {linkedAccounts.map((account) => {
                const providerInfo = PROVIDER_INFO[account.provider] || {
                  name: account.provider,
                  icon: '🔗',
                  color: 'bg-gray-500/10 text-gray-500',
                };
                return (
                  <div
                    key={account.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center text-sm ${providerInfo.color}`}
                      >
                        {providerInfo.icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{providerInfo.name}</p>
                        {account.createdAt && (
                          <p className="text-[11px] text-muted-foreground">
                            Connected {formatDate(account.createdAt)}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">Connected</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logout */}
      <MotionButton
        variant="outline"
        className="w-full"
        onClick={handleLogout}
        disabled={isLoggingOut}
        {...buttonAnimations.press}
      >
        <LogOut className="mr-2 h-4 w-4" />
        {isLoggingOut ? 'Logging out...' : 'Log out'}
      </MotionButton>

      {/* Subscription Drawer */}
      <SubscriptionDrawer
        open={isSubscriptionDrawerOpen}
        onOpenChange={setIsSubscriptionDrawerOpen}
      />
    </div>
  );
}

function AnonymousProfile() {
  const [isAuthDrawerOpen, setIsAuthDrawerOpen] = useState(false);
  const invalidateSession = useInvalidateSession();

  useEffect(() => { setIsAuthDrawerOpen(true); }, []);

  const handleAuthSuccess = () => {
    invalidateSession();
  };

  return (
    <>
      <div className="flex flex-col items-center text-center pt-8 pb-6">
        <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <User className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold mb-1">Join to unlock full access</h2>
        <p className="text-sm text-muted-foreground max-w-[260px]">
          Sign in to save your progress, earn credits, and access premium content
        </p>
      </div>

      <div className="space-y-3 max-w-sm mx-auto">
        <MotionButton
          className="w-full"
          onClick={() => setIsAuthDrawerOpen(true)}
          {...buttonAnimations.hoverPress}
        >
          Sign up or Log in
        </MotionButton>
      </div>

      <AuthDrawer
        open={isAuthDrawerOpen}
        onOpenChange={setIsAuthDrawerOpen}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}

const ProfilePage = () => {
  const { data: session, isPending } = useOptimizedSession();
  const isAuthenticated = !!session;
  const shouldReduceMotion = useReducedMotion() ?? false;

  return (
    <div className="h-full overflow-y-auto">
      {/* Simple header bar */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-center h-14">
          <h1 className="text-base font-semibold">Profile</h1>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 py-6">
        {isPending ? (
          <div className="flex flex-col items-center pt-8 space-y-4">
            <div className="h-20 w-20 rounded-full bg-muted animate-pulse" />
            <div className="h-5 w-32 rounded bg-muted animate-pulse" />
            <div className="h-4 w-48 rounded bg-muted animate-pulse" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {isAuthenticated ? (
              shouldReduceMotion ? (
                <div key="authenticated">
                  <AuthenticatedProfile />
                </div>
              ) : (
                <motion.div key="authenticated" {...FADE_VARIANTS} transition={FADE_TRANSITION}>
                  <AuthenticatedProfile />
                </motion.div>
              )
            ) : (
              shouldReduceMotion ? (
                <div key="anonymous">
                  <AnonymousProfile />
                </div>
              ) : (
                <motion.div key="anonymous" {...FADE_VARIANTS} transition={FADE_TRANSITION}>
                  <AnonymousProfile />
                </motion.div>
              )
            )}
          </AnimatePresence>
        )}
      </main>
    </div>
  );
};

export default ProfilePage;
