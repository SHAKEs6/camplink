import { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { Home, ShoppingBag, Heart, Megaphone, MessageCircle, Wallet, LayoutDashboard } from "lucide-react";
import { Logo } from "./Logo";
import { BottomNav } from "./BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "./NotificationBell";
import { OfflineBanner } from "./OfflineBanner";
import { DownloadAppButton } from "./DownloadAppButton";
import { useCartCount } from "@/hooks/useCartCount";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const cartCount = useCartCount();
  const [avatar, setAvatar] = useState<string | null>(null);
  const initials = (user?.email ?? "U").slice(0, 2).toUpperCase();
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => setAvatar(data?.avatar_url ?? null));
  }, [user]);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-lg">
        <OfflineBanner />
        <div className="mx-auto flex w-full max-w-2xl md:max-w-6xl items-center justify-between gap-4 px-4 md:px-8 py-3">
          <Link to="/" className="shrink-0"><Logo /></Link>
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {[
              { to: "/", label: "Home", icon: Home, end: true },
              { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
              { to: "/market", label: "Market", icon: ShoppingBag },
              { to: "/community", label: "Community", icon: Megaphone },
              { to: "/dating", label: "Hookup", icon: Heart },
              { to: "/chat", label: "Chat", icon: MessageCircle },
              { to: "/wallet", label: "Wallet", icon: Wallet },
            ].map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end as any}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-smooth ${
                    isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <DownloadAppButton />
            <NotificationBell />
            <Link to="/cart">
              <Button variant="ghost" size="icon" className="relative h-9 w-9">
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] gradient-accent border-0">
                    {cartCount > 9 ? "9+" : cartCount}
                  </Badge>
                )}
              </Button>
            </Link>
            <Link to="/profile">
              <Avatar className="h-9 w-9 border border-border ml-1">
                {avatar && <AvatarImage src={avatar} alt="me" />}
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>
        <div className="hairline-gold" />
      </header>

      <main className="mx-auto w-full max-w-2xl md:max-w-6xl px-4 md:px-8 py-4 md:py-8 animate-fade-in">{children}</main>
      <BottomNav />
    </div>
  );
};
