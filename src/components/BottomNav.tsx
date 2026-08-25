import { NavLink } from "react-router-dom";
import { Home, ShoppingBag, Heart, Megaphone, MessageCircle, User, Package } from "lucide-react";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

const baseItems = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/market", label: "Market", icon: ShoppingBag },
  { to: "/community", label: "Community", icon: Megaphone },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/orders", label: "Orders", icon: Package },
];

export const BottomNav = () => {
  const { hookup_enabled } = useFeatureFlags();
  const items = hookup_enabled ? [...baseItems.slice(0, 3), { to: "/dating", label: "Hookup", icon: Heart }, ...baseItems.slice(3)] : baseItems;
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg md:hidden">
    <div className={`mx-auto grid max-w-2xl ${hookup_enabled ? "grid-cols-7" : "grid-cols-6"}`}>
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 py-2.5 text-xs transition-smooth ${
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`
          }
        >
          <Icon className="h-5 w-5" />
          <span className="text-[10px] font-medium">{label}</span>
        </NavLink>
      ))}
    </div>
    </nav>
  );
};
