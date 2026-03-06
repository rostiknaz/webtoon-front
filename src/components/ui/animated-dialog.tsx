/**
 * Animated Dialog
 *
 * Radix Dialog with framer-motion enter/exit animations.
 * Pattern from https://motion.dev/examples/react-radix-dialog
 */

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const AnimatedDialog = DialogPrimitive.Root;

const AnimatedDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
AnimatedDialogTitle.displayName = 'AnimatedDialogTitle';

const AnimatedDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
AnimatedDialogDescription.displayName = 'AnimatedDialogDescription';

interface AnimatedDialogContentProps {
  open: boolean;
  children: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
}

function AnimatedDialogContent({
  open,
  children,
  className,
  showCloseButton = true,
}: AnimatedDialogContentProps) {
  return (
    <AnimatePresence>
      {open && (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay asChild>
            <motion.div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          </DialogPrimitive.Overlay>
          <DialogPrimitive.Content asChild>
            <motion.div
              className={cn(
                'fixed left-[50%] top-[50%] z-50 w-[calc(100%-2rem)] max-w-md rounded-xl border bg-background p-6 shadow-2xl focus:outline-none',
                className,
              )}
              initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-48%' }}
              animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
              exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-48%' }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0.15 }}
            >
              {children}
              {showCloseButton && (
                <DialogPrimitive.Close
                  className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              )}
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}

const AnimatedDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center', className)} {...props} />
);

export {
  AnimatedDialog,
  AnimatedDialogContent,
  AnimatedDialogHeader,
  AnimatedDialogTitle,
  AnimatedDialogDescription,
};
