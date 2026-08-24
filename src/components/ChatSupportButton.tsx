import { useState } from "react";
import { Headset, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const ChatSupportButton = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const openSupport = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setBusy(true);
    const { data, error } = await (supabase.rpc as any)("open_support_chat");
    setBusy(false);
    if (error) {
      toast.error("Chat support is not available yet. Please try again later.");
      return;
    }
    navigate(`/chat?c=${data}`);
  };

  return (
    <Button
      onClick={openSupport}
      disabled={busy}
      className="fixed bottom-4 right-4 z-[100] h-12 rounded-full gradient-accent px-4 shadow-xl"
      aria-label="Open chat support"
    >
      {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Headset className="mr-2 h-5 w-5" />}
      <span className="text-xs font-bold">Chat support</span>
    </Button>
  );
};
