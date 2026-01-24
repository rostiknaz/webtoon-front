import { useState, useEffect } from 'react';
import { useLocation } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth.client';
import { useInvalidateSession } from '@/hooks/useOptimizedSession';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { MotionButton, buttonAnimations } from '@/components/ui/motion-button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Mail, Loader2, AlertCircle, Eye, EyeOff, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GoogleIcon } from '@/components/icons';

interface AuthDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type AuthMode = 'initial' | 'login' | 'signup';

// Zod Validation Schemas
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

const signupSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be less than 100 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character (!@#$%^&*)'),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type SignupFormValues = z.infer<typeof signupSchema>;

// Password strength calculator
function calculatePasswordStrength(password: string): number {
  if (!password) return 0;
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;
  return Math.min(strength, 4);
}

// Password strength indicator component
function PasswordStrengthIndicator({ password }: { password: string }) {
  const strength = calculatePasswordStrength(password);

  if (!password) return null;

  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
  ];

  return (
    <div className="mt-2" role="status" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={cn(
              'h-1 flex-1 rounded transition-colors',
              strength >= level ? strengthColors[strength - 1] : 'bg-muted'
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Password strength: {strengthLabels[strength]}
      </p>
    </div>
  );
}

export function AuthDrawer({ open, onOpenChange, onSuccess }: AuthDrawerProps) {
  const [mode, setMode] = useState<AuthMode>('initial');
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const location = useLocation();
  const invalidateSession = useInvalidateSession();

  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onBlur',
  });

  // Signup form
  const signupForm = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  // Reset forms and mode when drawer closes
  useEffect(() => {
    if (!open) {
      const timeout = setTimeout(() => {
        setMode('initial');
        setShowPassword(false);
        setIsGoogleLoading(false);
        loginForm.reset();
        signupForm.reset();
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [open, loginForm, signupForm]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleContinueWithEmail = () => {
    setMode('login');
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const result = await authClient.signIn.social({
        provider: 'google',
        callbackURL: `${location.pathname}?login_success=google`,
      });

      // Check for error in response (API returns error object, doesn't throw)
      if (result?.error) {
        setIsGoogleLoading(false);
        toast.error('Google Sign In Failed', {
          description: result.error.message || 'Failed to connect with Google. Please try again.',
        });
      }
      // Note: On success, this redirects to Google, so no need to reset loading
    } catch {
      setIsGoogleLoading(false);
      toast.error('Google Sign In Failed', {
        description: 'Failed to connect with Google. Please try again.',
      });
    }
  };

  const handleLogin = async (values: LoginFormValues) => {
    try {
      const result = await authClient.signIn.email({
        email: values.email,
        password: values.password,
      });

      if (result.error) {
        const errorMessage = result.error.message || 'Invalid email or password';
        loginForm.setError('root', {
          type: 'manual',
          message: errorMessage,
        });
        toast.error('Sign In Failed', {
          description: errorMessage,
        });
      } else {
        // Invalidate session cache so Header updates immediately
        invalidateSession();
        toast.success('Welcome back!', {
          description: 'You have been signed in successfully.',
        });
        handleClose();
        onSuccess?.();
      }
    } catch {
      const errorMessage = 'Failed to sign in. Please try again.';
      loginForm.setError('root', {
        type: 'manual',
        message: errorMessage,
      });
      toast.error('Sign In Failed', {
        description: errorMessage,
      });
    }
  };

  const handleSignup = async (values: SignupFormValues) => {
    try {
      const result = await authClient.signUp.email({
        email: values.email,
        password: values.password,
        name: values.name,
      });

      if (result.error) {
        // Handle specific error cases
        if (result.error.message?.includes('already exists')) {
          const errorMessage = 'An account with this email already exists.';
          signupForm.setError('email', {
            type: 'manual',
            message: errorMessage,
          });
          signupForm.setError('root', {
            type: 'manual',
            message: 'Please sign in instead or use a different email.',
          });
          toast.error('Sign Up Failed', {
            description: errorMessage,
          });
        } else {
          const errorMessage = result.error.message || 'Failed to create account';
          signupForm.setError('root', {
            type: 'manual',
            message: errorMessage,
          });
          toast.error('Sign Up Failed', {
            description: errorMessage,
          });
        }
      } else {
        // Auto-login after successful signup
        const loginResult = await authClient.signIn.email({
          email: values.email,
          password: values.password,
        });

        if (loginResult.error) {
          toast.success('Account created!', {
            description: 'Please sign in to continue.',
          });
          setMode('login');
          loginForm.setValue('email', values.email);
        } else {
          // Invalidate session cache so Header updates immediately
          invalidateSession();
          toast.success('Account created!', {
            description: 'Welcome! You have been signed in.',
          });
          handleClose();
          onSuccess?.();
        }
      }
    } catch {
      const errorMessage = 'Failed to create account. Please try again.';
      signupForm.setError('root', {
        type: 'manual',
        message: errorMessage,
      });
      toast.error('Sign Up Failed', {
        description: errorMessage,
      });
    }
  };

  const currentPassword = signupForm.watch('password');

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="max-h-[90vh] flex flex-col"
        aria-describedby="auth-description"
      >
        <DrawerHeader className="text-center pb-4">
          <DrawerTitle className="text-2xl font-bold flex items-center justify-center gap-2">
            <Lock className="h-6 w-6 text-primary" aria-hidden="true" />
            {mode === 'initial' && 'Unlock Premium Content'}
            {mode === 'login' && 'Welcome Back'}
            {mode === 'signup' && 'Create Account'}
          </DrawerTitle>
          <DrawerDescription id="auth-description" className="text-muted-foreground">
            {mode === 'initial' && 'Sign in to watch premium episodes and unlock exclusive content'}
            {mode === 'login' && 'Sign in to your account to continue watching'}
            {mode === 'signup' && 'Create an account to access all premium content'}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {/* Initial Screen - Social Login & Email Options */}
          {mode === 'initial' && (
            <div className="space-y-4 max-w-md mx-auto">
              {/* Google Sign In Button */}
              <MotionButton
                onClick={handleGoogleSignIn}
                variant="outline"
                className="w-full h-12 text-base font-medium"
                size="lg"
                disabled={isGoogleLoading}
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
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>

              {/* Email Sign In Button */}
              <MotionButton
                onClick={handleContinueWithEmail}
                className="w-full h-12 text-base font-medium"
                size="lg"
                disabled={isGoogleLoading}
                {...buttonAnimations.hoverPress}
              >
                <Mail className="mr-2 h-5 w-5" aria-hidden="true" />
                Continue with Email
              </MotionButton>

              <p className="text-center text-sm text-muted-foreground">
                By continuing, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          )}

          {/* Login Form */}
          {mode === 'login' && (
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4 max-w-md mx-auto">
                {/* Global error message */}
                {loginForm.formState.errors.root && (
                  <Alert variant="destructive" role="alert">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    <AlertDescription>
                      {loginForm.formState.errors.root.message}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Email field */}
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                          <Input
                            type="email"
                            placeholder="your@email.com"
                            autoComplete="email"
                            autoFocus
                            className="pl-10 h-11"
                            aria-invalid={fieldState.invalid}
                            disabled={loginForm.formState.isSubmitting}
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
                  control={loginForm.control}
                  name="password"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            className="pl-10 pr-10 h-11"
                            aria-invalid={fieldState.invalid}
                            disabled={loginForm.formState.isSubmitting}
                            {...field}
                          />
                          <MotionButton
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-11 w-11 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            {...buttonAnimations.iconPulse}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <Eye className="h-4 w-4" aria-hidden="true" />
                            )}
                          </MotionButton>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={loginForm.formState.isSubmitting}
                >
                  {loginForm.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setShowPassword(false);
                    }}
                    className="text-sm text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                    disabled={loginForm.formState.isSubmitting}
                  >
                    Don't have an account? Sign up
                  </button>
                </div>

                {/* Screen reader announcements */}
                <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                  {loginForm.formState.isSubmitting && 'Signing in, please wait'}
                </div>
              </form>
            </Form>
          )}

          {/* Signup Form */}
          {mode === 'signup' && (
            <Form {...signupForm}>
              <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4 max-w-md mx-auto">
                {/* Global error message */}
                {signupForm.formState.errors.root && (
                  <Alert variant="destructive" role="alert">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    <AlertDescription>
                      {signupForm.formState.errors.root.message}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Name field */}
                <FormField
                  control={signupForm.control}
                  name="name"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                          <Input
                            type="text"
                            placeholder="Your name"
                            autoComplete="name"
                            autoFocus
                            className="pl-10 h-11"
                            aria-invalid={fieldState.invalid}
                            disabled={signupForm.formState.isSubmitting}
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Email field */}
                <FormField
                  control={signupForm.control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                          <Input
                            type="email"
                            placeholder="your@email.com"
                            autoComplete="email"
                            className="pl-10 h-11"
                            aria-invalid={fieldState.invalid}
                            disabled={signupForm.formState.isSubmitting}
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
                  control={signupForm.control}
                  name="password"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Create a strong password"
                            autoComplete="new-password"
                            className="pl-10 pr-10 h-11"
                            aria-invalid={fieldState.invalid}
                            aria-describedby="password-requirements"
                            disabled={signupForm.formState.isSubmitting}
                            {...field}
                          />
                          <MotionButton
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-11 w-11 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            {...buttonAnimations.iconPulse}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <Eye className="h-4 w-4" aria-hidden="true" />
                            )}
                          </MotionButton>
                        </div>
                      </FormControl>
                      <FormMessage />
                      <PasswordStrengthIndicator password={currentPassword} />
                    </FormItem>
                  )}
                />

                <div id="password-requirements" className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">Password must contain:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>At least 8 characters</li>
                    <li>One uppercase and one lowercase letter</li>
                    <li>One number</li>
                    <li>One special character (!@#$%^&*)</li>
                  </ul>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={signupForm.formState.isSubmitting}
                >
                  {signupForm.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      Creating account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setShowPassword(false);
                    }}
                    className="text-sm text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                    disabled={signupForm.formState.isSubmitting}
                  >
                    Already have an account? Sign in
                  </button>
                </div>

                {/* Screen reader announcements */}
                <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                  {signupForm.formState.isSubmitting && 'Creating account, please wait'}
                </div>
              </form>
            </Form>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
