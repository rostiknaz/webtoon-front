/**
 * MotionButton Component
 *
 * Extends the base Button component with Framer Motion animations.
 * Supports whileHover, whileTap, and other motion props while
 * maintaining full compatibility with Radix UI's asChild pattern.
 *
 * @example
 * // Basic usage with tap animation
 * <MotionButton whileTap={{ scale: 0.95 }}>Click me</MotionButton>
 *
 * @example
 * // With hover and tap
 * <MotionButton
 *   whileHover={{ scale: 1.05 }}
 *   whileTap={{ scale: 0.95 }}
 *   variant="outline"
 * >
 *   Animated Button
 * </MotionButton>
 *
 * @example
 * // As Radix Dialog trigger
 * <Dialog.Trigger asChild>
 *   <MotionButton whileTap={{ scale: 0.95 }}>Open Dialog</MotionButton>
 * </Dialog.Trigger>
 */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { motion, type HTMLMotionProps } from "framer-motion";
import { type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

// Motion props we want to support
type MotionAnimationProps = {
  whileHover?: HTMLMotionProps<"button">["whileHover"];
  whileTap?: HTMLMotionProps<"button">["whileTap"];
  whileFocus?: HTMLMotionProps<"button">["whileFocus"];
  whileDrag?: HTMLMotionProps<"button">["whileDrag"];
  whileInView?: HTMLMotionProps<"button">["whileInView"];
  initial?: HTMLMotionProps<"button">["initial"];
  animate?: HTMLMotionProps<"button">["animate"];
  exit?: HTMLMotionProps<"button">["exit"];
  transition?: HTMLMotionProps<"button">["transition"];
  variants?: HTMLMotionProps<"button">["variants"];
  layout?: HTMLMotionProps<"button">["layout"];
  layoutId?: HTMLMotionProps<"button">["layoutId"];
};

export interface MotionButtonProps
  extends VariantProps<typeof buttonVariants>,
    MotionAnimationProps {
  asChild?: boolean;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLButtonElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLButtonElement>;
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * Default animation presets for common use cases
 */
export const buttonAnimations = {
  // Subtle press effect (recommended for most buttons)
  press: {
    whileTap: { scale: 0.97 },
    transition: { type: "spring" as const, stiffness: 400, damping: 17 },
  },
  // More noticeable press with slight rotation
  pressRotate: {
    whileTap: { scale: 0.95, rotate: -1 },
    transition: { type: "spring" as const, stiffness: 400, damping: 17 },
  },
  // Hover grow + press shrink
  hoverPress: {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.97 },
    transition: { type: "spring" as const, stiffness: 400, damping: 17 },
  },
  // Bounce effect
  bounce: {
    whileTap: { scale: 0.9 },
    transition: { type: "spring" as const, stiffness: 500, damping: 15 },
  },
  // Glow/lift effect for primary actions
  lift: {
    whileHover: { scale: 1.02, y: -2 },
    whileTap: { scale: 0.98, y: 0 },
    transition: { type: "spring" as const, stiffness: 400, damping: 17 },
  },
  // Icon button pulse
  iconPulse: {
    whileHover: { scale: 1.1 },
    whileTap: { scale: 0.9 },
    transition: { type: "spring" as const, stiffness: 400, damping: 17 },
  },
} as const;

const MotionButton = React.forwardRef<HTMLButtonElement, MotionButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      children,
      disabled,
      type,
      onClick,
      onMouseEnter,
      onMouseLeave,
      // Motion props
      whileHover,
      whileTap,
      whileFocus,
      whileDrag,
      whileInView,
      initial,
      animate,
      exit,
      transition,
      variants,
      layout,
      layoutId,
    },
    ref
  ) => {
    const motionProps = {
      whileHover,
      whileTap,
      whileFocus,
      whileDrag,
      whileInView,
      initial,
      animate,
      exit,
      transition,
      variants,
      layout,
      layoutId,
    };

    // Filter out undefined motion props
    const filteredMotionProps = Object.fromEntries(
      Object.entries(motionProps).filter(([, value]) => value !== undefined)
    );

    if (asChild) {
      // When asChild is true, wrap in motion.span for animations
      return (
        <motion.span
          className="inline-flex"
          {...filteredMotionProps}
        >
          <Slot
            className={cn(buttonVariants({ variant, size, className }))}
          >
            {children}
          </Slot>
        </motion.span>
      );
    }

    return (
      <motion.button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled}
        type={type}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        {...filteredMotionProps}
      >
        {children}
      </motion.button>
    );
  }
);
MotionButton.displayName = "MotionButton";

export { MotionButton };
