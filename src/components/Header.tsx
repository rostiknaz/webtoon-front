import { Search, Menu, Bell, User, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MotionButton, buttonAnimations } from "@/components/ui/motion-button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { authClient } from "@/lib/auth.client";
import { AuthDrawer } from "@/components/AuthDrawer";
import { useOptimizedSession, useInvalidateSession } from "@/hooks/useOptimizedSession";

const Header = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAuthDrawerOpen, setIsAuthDrawerOpen] = useState(false);
  const session = useOptimizedSession();
  const invalidateSession = useInvalidateSession();

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Trending", href: "#trending" },
    { label: "New Releases", href: "#new" },
    { label: "Genres", href: "#genres" },
    { label: "My List", href: "#mylist" },
  ];

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          // Invalidate in parallel - don't wait for completion before redirect
          void invalidateSession();
          window.location.href = "/";
        },
      },
    });
  };

  // Get user initials for avatar fallback
  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center glow-primary">
                <span className="text-primary-foreground font-display font-bold text-xl">A</span>
              </div>
              <span className="hidden sm:block font-display font-bold text-xl text-foreground">
                Ani<span className="text-primary">Stream</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-6">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              {isSearchOpen ? (
                <div className="flex items-center gap-2 animate-fade-in">
                  <Input
                    type="search"
                    name="search"
                    placeholder="Search anime..."
                    className="w-48 md:w-64 bg-secondary border-border focus:border-primary"
                    autoFocus
                    onBlur={() => setIsSearchOpen(false)}
                    aria-label="Search anime"
                  />
                </div>
              ) : (
                <MotionButton
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setIsSearchOpen(true)}
                  aria-label="Open search"
                  {...buttonAnimations.iconPulse}
                >
                  <Search className="h-5 w-5" />
                </MotionButton>
              )}
            </div>

            <MotionButton
              variant="ghost"
              size="icon"
              className="hidden md:flex text-muted-foreground hover:text-foreground"
              aria-label="Notifications"
              {...buttonAnimations.iconPulse}
            >
              <Bell className="h-5 w-5" />
            </MotionButton>

            {/* User Menu */}
            {session.isPending ? (
              // Loading state
              <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
            ) : session.data?.user ? (
              // Logged in - show dropdown
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarImage
                        src={session.data.user.image || undefined}
                        alt={session.data.user.name || "User"}
                      />
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {getInitials(session.data.user.name, session.data.user.email)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {session.data.user.name || "User"}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {session.data.user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/account" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      My Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              // Not logged in - show sign in button
              <MotionButton
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setIsAuthDrawerOpen(true)}
                aria-label="Sign in"
                {...buttonAnimations.iconPulse}
              >
                <User className="h-5 w-5" />
              </MotionButton>
            )}

            <MotionButton
              variant="ghost"
              size="icon"
              className="lg:hidden text-muted-foreground hover:text-foreground"
              aria-label="Open menu"
              {...buttonAnimations.iconPulse}
            >
              <Menu className="h-5 w-5" />
            </MotionButton>
          </div>
        </div>
      </header>

      {/* Auth Drawer for sign in/sign up */}
      <AuthDrawer open={isAuthDrawerOpen} onOpenChange={setIsAuthDrawerOpen} />
    </>
  );
};

export default Header;
