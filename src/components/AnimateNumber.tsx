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
}

const SPRING_CONFIG = { stiffness: 100, damping: 30 };

export function AnimateNumber({ value, className }: AnimateNumberProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const spring = useSpring(value, SPRING_CONFIG);
  const display = useTransform(spring, (v) => Math.round(v).toString());

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  if (shouldReduceMotion) {
    return <span className={className}>{value}</span>;
  }

  return <motion.span className={className}>{display}</motion.span>;
}
