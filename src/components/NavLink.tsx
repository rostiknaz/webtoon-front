import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import { forwardRef } from "react";
import { cn } from '@/lib/utils';

interface NavLinkProps extends Omit<LinkProps, "className"> {
    className?: string;
    activeClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
    ({ className, activeClassName, to, ...props }, ref) => {
        return (
            <Link
                ref={ref}
                to={to}
                className={className}
                activeProps={{ className: cn(className, activeClassName) }}
                {...props}
            />
        );
    },
);

NavLink.displayName = "NavLink";

export { NavLink };