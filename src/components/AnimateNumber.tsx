/**
 * AnimateNumber Component
 *
 * Reusable spring-based number animation using framer-motion.
 * Rolls smoothly from previous value to new value.
 * Respects useReducedMotion for accessibility.
 */

import { useEffect } from 'react';
import { motion, useSpring, useTransform, useReducedMotion } from 'framer-motion';

interface AnimateNumberProps {
  value: number;
  className?: string;
  format?: (value: number) => string;
}

const SPRING_CONFIG = { stiffness: 100, damping: 30 };
const DEFAULT_FORMAT = (v: number) => Math.round(v).toString();

export function AnimateNumber({ value, className, format = DEFAULT_FORMAT }: AnimateNumberProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const spring = useSpring(value, SPRING_CONFIG);
  const display = useTransform(spring, (v) => format(Math.round(v)));

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  if (shouldReduceMotion) {
    return <span className={className}>{format(value)}</span>;
  }

  return <motion.span className={className}>{display}</motion.span>;
}
