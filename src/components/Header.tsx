import { Search, Menu, Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const Header = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const navLinks = [
    { label: "Home", href: "#" },
    { label: "Trending", href: "#trending" },
    { label: "New Releases", href: "#new" },
    { label: "Genres", href: "#genres" },
    { label: "My List", href: "#mylist" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="container flex items-center justify-between h-16 md:h-20">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <a href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center glow-primary">
              <span className="text-primary-foreground font-display font-bold text-xl">A</span>
            </div>
            <span className="hidden sm:block font-display font-bold text-xl text-foreground">
              Ani<span className="text-primary">Stream</span>
            </span>
          </a>

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
                  type="text"
                  placeholder="Search anime..."
                  className="w-48 md:w-64 bg-secondary border-border focus:border-primary"
                  autoFocus
                  onBlur={() => setIsSearchOpen(false)}
                />
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setIsSearchOpen(true)}
              >
                <Search className="h-5 w-5" />
              </Button>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="hidden md:flex text-muted-foreground hover:text-foreground"
          >
            <Bell className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <User className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
