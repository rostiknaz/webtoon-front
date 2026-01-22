/**
 * MotionDialog Component
 *
 * Extends Radix Dialog with Framer Motion animations for smooth
 * enter/exit transitions. Uses AnimatePresence for proper exit animations.
 *
 * @example
 * <MotionDialog open={isOpen} onOpenChange={setIsOpen}>
 *   <MotionDialogTrigger asChild>
 *     <MotionButton whileTap={{ scale: 0.95 }}>Open</MotionButton>
 *   </MotionDialogTrigger>
 *   <MotionDialogContent>
 *     <MotionDialogHeader>
 *       <MotionDialogTitle>Title</MotionDialogTitle>
 *     </MotionDialogHeader>
 *     <p>Content here</p>
 *   </MotionDialogContent>
 * </MotionDialog>
 */

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";

const MotionDialog = DialogPrimitive.Root;
const MotionDialogTrigger = DialogPrimitive.Trigger;
const MotionDialogPortal = DialogPrimitive.Portal;
const MotionDialogClose = DialogPrimitive.Close;

// Animation variants for overlay
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

// Animation variants for content
const contentVariants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: -10,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -10,
    transition: {
      duration: 0.15,
      ease: "easeIn" as const,
    },
  },
};

interface MotionDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Whether the dialog is open (required for AnimatePresence) */
  isOpen?: boolean;
}

const MotionDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  MotionDialogContentProps
>(({ className, children, isOpen = true, ...props }, ref) => (
  <AnimatePresence>
    {isOpen && (
      <MotionDialogPortal forceMount>
        {/* Animated Overlay */}
        <DialogPrimitive.Overlay asChild forceMount>
          <motion.div
            className={cn("fixed inset-0 z-50 bg-black/80")}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
          />
        </DialogPrimitive.Overlay>

        {/* Animated Content */}
        <DialogPrimitive.Content asChild forceMount ref={ref} {...props}>
          <motion.div
            className={cn(
              "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
              className
            )}
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {children}
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </motion.div>
        </DialogPrimitive.Content>
      </MotionDialogPortal>
    )}
  </AnimatePresence>
));
MotionDialogContent.displayName = "MotionDialogContent";

interface MotionDialogSectionProps {
  className?: string;
  children?: React.ReactNode;
}

const MotionDialogHeader = ({ className, children }: MotionDialogSectionProps) => (
  <motion.div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.1 }}
  >
    {children}
  </motion.div>
);
MotionDialogHeader.displayName = "MotionDialogHeader";

const MotionDialogFooter = ({ className, children }: MotionDialogSectionProps) => (
  <motion.div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.15 }}
  >
    {children}
  </motion.div>
);
MotionDialogFooter.displayName = "MotionDialogFooter";

const MotionDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
MotionDialogTitle.displayName = "MotionDialogTitle";

const MotionDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
MotionDialogDescription.displayName = "MotionDialogDescription";

export {
  MotionDialog,
  MotionDialogPortal,
  MotionDialogClose,
  MotionDialogTrigger,
  MotionDialogContent,
  MotionDialogHeader,
  MotionDialogFooter,
  MotionDialogTitle,
  MotionDialogDescription,
};
