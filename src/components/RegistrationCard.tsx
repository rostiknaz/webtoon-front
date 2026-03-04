/**
 * RegistrationCard Component
 *
 * Full-screen feed slide that prompts anonymous visitors to register.
 * Renders inline in the Swiper feed, matching FeedSlide dimensions.
 * Features Google OAuth (primary CTA) and email/password form (secondary).
 */

import { useState, useCallback, memo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth.client';
import { useInvalidateSession } from '@/hooks/useOptimizedSession';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { MotionButton, buttonAnimations } from '@/components/ui/motion-button';
import { Input } from '@/components/ui/input';
import { GoogleIcon } from '@/components/icons';
import { Loader2, Mail, Lock, User, ChevronDown, ChevronUp } from 'lucide-react';

// ── Constants ──

const SPRING_TRANSITION = { type: 'spring' as const, stiffness: 300, damping: 24 };
const FORM_DEFAULT_VALUES = { name: '', email: '', password: '' } as const;

const signupSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email')
    .toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be less than 100 characters'),
});

type FormValues = z.infer<typeof signupSchema>;

// ── Props ──

interface RegistrationCardProps {
  onDismiss: () => void;
  onRegistered: () => void;
}

// ── Component ──

export const RegistrationCard = memo(function RegistrationCard({
  onDismiss,
  onRegistered,
}: RegistrationCardProps) {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const invalidateSession = useInvalidateSession();
  const markRegistered = usePreferencesStore((s) => s.markRegistered);
  const shouldReduceMotion = useReducedMotion() ?? false;

  const form = useForm<FormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: FORM_DEFAULT_VALUES,
    mode: 'onBlur',
  });

  const switchMode = useCallback((newMode: 'signup' | 'login') => {
    setMode(newMode);
    form.clearErrors();
    // In login mode, set a placeholder name so schema validation passes
    // (name field is hidden in login mode but schema still requires it)
    if (newMode === 'login') {
      form.setValue('name', 'login');
    } else {
      form.setValue('name', '');
    }
  }, [form]);

  const handleSuccess = useCallback(() => {
    markRegistered();
    invalidateSession();
    toast.success('Welcome! You have 3 free downloads', {
      description: 'Start exploring and download your favorite clips.',
    });
    onRegistered();
  }, [markRegistered, invalidateSession, onRegistered]);

  const handleGoogleSignIn = useCallback(async () => {
    setIsGoogleLoading(true);
    try {
      const result = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/feed?login_success=google',
      });

      if (result?.error) {
        setIsGoogleLoading(false);
        toast.error('Google Sign In Failed', {
          description: result.error.message || 'Please try again.',
        });
      }
      // On success, redirects to Google — no need to reset loading
    } catch {
      setIsGoogleLoading(false);
      toast.error('Google Sign In Failed', {
        description: 'Failed to connect with Google. Please try again.',
      });
    }
  }, []);

  const handleEmailSubmit = useCallback(async (values: FormValues) => {
    try {
      if (mode === 'signup') {
        const result = await authClient.signUp.email({
          email: values.email,
          password: values.password,
          name: values.name,
        });

        if (result.error) {
          if (result.error.message?.includes('already exists')) {
            form.setError('email', {
              type: 'manual',
              message: 'Account exists — try logging in instead',
            });
            switchMode('login');
          } else {
            form.setError('root', {
              type: 'manual',
              message: result.error.message || 'Failed to create account',
            });
          }
          return;
        }

        // Auto-login after signup
        const loginResult = await authClient.signIn.email({
          email: values.email,
          password: values.password,
        });

        if (loginResult.error) {
          toast.info('Account created! Please sign in to continue.');
          switchMode('login');
        } else {
          handleSuccess();
        }
      } else {
        // Login mode
        const result = await authClient.signIn.email({
          email: values.email,
          password: values.password,
        });

        if (result.error) {
          form.setError('root', {
            type: 'manual',
            message: result.error.message || 'Invalid email or password',
          });
        } else {
          handleSuccess();
        }
      }
    } catch {
      form.setError('root', {
        type: 'manual',
        message: 'Something went wrong. Please try again.',
      });
    }
  }, [mode, form, handleSuccess, switchMode]);

  const Wrapper = shouldReduceMotion ? 'div' : motion.div;
  const wrapperProps = shouldReduceMotion ? {} : {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    transition: SPRING_TRANSITION,
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-background brand-gradient-2">
      <Wrapper
        {...wrapperProps}
        className="w-full max-w-sm mx-auto px-6 flex flex-col items-center text-center"
      >
        {/* Headline */}
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Unlock Unlimited Browsing
        </h2>
        <p className="text-muted-foreground text-sm mb-8">
          Sign up and get <span className="text-primary font-semibold">3 free downloads</span>
        </p>

        {/* Google OAuth — Primary CTA */}
        <MotionButton
          onClick={handleGoogleSignIn}
          variant="outline"
          className="w-full h-12 text-base font-medium mb-4"
          size="lg"
          disabled={isGoogleLoading || form.formState.isSubmitting}
          {...buttonAnimations.hoverPress}
        >
          {isGoogleLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
              Connecting...
            </>
          ) : (
            <>
              <GoogleIcon className="mr-2 h-5 w-5" />
              Continue with Google
            </>
          )}
        </MotionButton>

        {/* Divider */}
        <div className="relative w-full mb-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Email form toggle */}
        {!showEmailForm ? (
          <Button
            variant="secondary"
            className="w-full h-11 mb-6"
            onClick={() => setShowEmailForm(true)}
          >
            <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
            Continue with Email
            <ChevronDown className="ml-auto h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="mb-3 text-muted-foreground"
              onClick={() => setShowEmailForm(false)}
            >
              <ChevronUp className="mr-1 h-4 w-4" aria-hidden="true" />
              Hide email form
            </Button>

            <AnimatePresence>
              <motion.div
                key="email-form"
                initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full overflow-hidden"
              >
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(handleEmailSubmit)}
                    className="space-y-3 w-full"
                  >
                    {/* Root error */}
                    {form.formState.errors.root && (
                      <p className="text-sm text-destructive text-center">
                        {form.formState.errors.root.message}
                      </p>
                    )}

                    {/* Name field — only in signup mode */}
                    {mode === 'signup' && (
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormControl>
                              <div className="relative">
                                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                                <Input
                                  type="text"
                                  placeholder="Your name"
                                  autoComplete="name"
                                  className="pl-10 h-10"
                                  aria-invalid={fieldState.invalid}
                                  disabled={form.formState.isSubmitting}
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Email field */}
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field, fieldState }) => (
                        <FormItem>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                              <Input
                                type="email"
                                placeholder="your@email.com"
                                autoComplete="email"
                                className="pl-10 h-10"
                                aria-invalid={fieldState.invalid}
                                disabled={form.formState.isSubmitting}
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Password field */}
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field, fieldState }) => (
                        <FormItem>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                              <Input
                                type="password"
                                placeholder={mode === 'signup' ? 'Create a password (8+ chars)' : 'Your password'}
                                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                                className="pl-10 h-10"
                                aria-invalid={fieldState.invalid}
                                disabled={form.formState.isSubmitting}
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full h-10"
                      disabled={form.formState.isSubmitting}
                    >
                      {form.formState.isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                          {mode === 'signup' ? 'Creating account...' : 'Signing in...'}
                        </>
                      ) : (
                        mode === 'signup' ? 'Create Account' : 'Sign In'
                      )}
                    </Button>

                    {/* Mode toggle */}
                    <p className="text-center text-sm">
                      <button
                        type="button"
                        onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
                        className="text-primary hover:underline"
                      >
                        {mode === 'signup' ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
                      </button>
                    </p>
                  </form>
                </Form>
              </motion.div>
            </AnimatePresence>
          </>
        )}

        {/* Dismiss link */}
        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Maybe later
        </button>
      </Wrapper>
    </div>
  );
});
