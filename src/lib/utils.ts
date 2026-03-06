import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format cents as dollar currency string (e.g., 999 → "$9.99") */
export function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Extract up to 2 initials from a user's name or email for avatar fallback */
export function getInitials(name?: string | null, email?: string): string {
  if (name) {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return 'U';
}
