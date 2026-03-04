/**
 * Profile Page
 *
 * Lightweight profile overview accessible from the bottom nav.
 * - Authenticated: avatar, name, email, credits, subscription, logout
 * - Anonymous: prompt to log in or sign up via AuthDrawer
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { authClient } from '@/lib/auth.client';
import { useOptimizedSession, useInvalidateSession } from '@/hooks/useOptimizedSession';
import { useCredits } from '@/hooks/useCredits';
import { useSubscription } from '@/hooks/useSubscription';
import { AuthDrawer } from '@/components/AuthDrawer';
import { BottomNav } from '@/components/BottomNav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MotionButton, buttonAnimations } from '@/components/ui/motion-button';
import { getInitials } from '@/lib/utils';
import {
  User,
  LogOut,
  Coins,
  Crown,
  Download,
  ChevronRight,
  Settings,
} from 'lucide-react';

const FADE_TRANSITION = { duration: 0.2 };
const FADE_VARIANTS = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

function AuthenticatedProfile() {
  const { data: session } = useOptimizedSession();
  const invalidateSession = useInvalidateSession();
  const navigate = useNavigate();
  const { balance, freeDownloads } = useCredits();
  const { data: subscription } = useSubscription();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
            navigate({ to: '/feed' });
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
                  {subscription.hasSubscription ? 'Premium plan' : 'Free tier'}
                </p>
              </div>
            </div>
            <Badge variant={subscription.hasSubscription ? 'default' : 'secondary'}>
              {subscription.hasSubscription ? 'Active' : 'Free'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* My Account link */}
      <Card>
        <CardContent className="py-0">
          <Link
            to="/account"
            className="flex items-center justify-between py-4 text-sm font-medium hover:text-primary transition-colors"
          >
            <div className="flex items-center gap-3">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span>My Account</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
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
    </div>
  );
}

function AnonymousProfile() {
  const [isAuthDrawerOpen, setIsAuthDrawerOpen] = useState(false);
  const invalidateSession = useInvalidateSession();

  // Auto-open AuthDrawer once on initial mount (not on remounts from session flicker)
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
    <div className="min-h-screen bg-background pb-20">
      {/* Simple header bar */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container flex items-center justify-center h-14">
          <h1 className="text-base font-semibold">Profile</h1>
        </div>
      </div>

      <main className="container max-w-md mx-auto px-4 py-6">
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

      <BottomNav />
    </div>
  );
};

export default ProfilePage;
