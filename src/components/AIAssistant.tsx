import { useEffect, useState } from "react";
import { Bot, Send, X, MessageCircle, ExternalLink } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Message = { role: "user" | "assistant"; content: string; createdAt: number };
const welcome = "Hi! I am the Camplink Connect Assistant. I can help you with payments, orders, your account, and navigating Camplink Connect. What can I help you with?";
const prompts = ["How do I make a payment?", "What payment methods are supported?", "Where is my order?", "How does Camplink Connect work?", "I need help with my account", "Contact support"];

const sessionKey = () => {
  const key = "camplink-ai-session";
  const current = sessionStorage.getItem(key);
  if (current) return current;
  const next = crypto.randomUUID();
  sessionStorage.setItem(key, next);
  return next;
};

export const AIAssistant = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [supportUrl, setSupportUrl] = useState("/chat");
  const [welcomeMessage, setWelcomeMessage] = useState(welcome);

  useEffect(() => {
    if (!open) return;
    let active = true;
    (supabase as any).from("ai_settings").select("welcome_message,support_url,enabled").eq("id", true).maybeSingle().then(({ data }: any) => {
      if (!active) return;
      if (data?.welcome_message) setWelcomeMessage(data.welcome_message);
      if (data?.support_url) setSupportUrl(data.support_url);
      if (data?.enabled === false) setError("The assistant is temporarily unavailable.");
      if (messages.length === 0) setMessages([{ role: "assistant", content: data?.welcome_message || welcome, createdAt: Date.now() }]);
    });
    return () => { active = false; };
  }, [open, messages.length]);

  const send = async (value = input) => {
    const message = value.trim();
    if (!message || busy) return;
    setInput(""); setError("");
    setMessages(current => [...current, { role: "user", content: message, createdAt: Date.now() }]);
    setBusy(true);
    const { data, error: requestError } = await supabase.functions.invoke("ai-chat", { body: { message, session_key: sessionKey(), current_page: location.pathname } });
    setBusy(false);
    if (requestError || data?.error) { setError(data?.error || requestError?.message || "The assistant is unavailable right now."); return; }
    setSupportUrl(data.support_url || "/chat");
    setMessages(current => [...current, { role: "assistant", content: data.answer, createdAt: Date.now() }]);
  };

  const openSupport = async () => {
    if (!user) { navigate("/auth"); return; }
    const { data, error } = await (supabase.rpc as any)("open_support_chat");
    if (error) { setError(error.message); return; }
    navigate(`/chat?c=${data}`);
    setOpen(false);
  };

  return (
    <>
      {open && <div className="fixed bottom-20 right-3 z-[65] flex h-[min(680px,calc(100vh-6rem))] w-[min(390px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-primary/10 px-4 py-3"><div className="flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground"><Bot className="h-5 w-5" /></div><div><p className="font-semibold">Camplink Assistant</p><p className="text-[11px] text-muted-foreground">Verified platform help</p></div></div><Button size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Close assistant"><X className="h-4 w-4" /></Button></div>
        <ScrollArea className="min-h-0 flex-1 px-3"><div className="space-y-3 py-3">{messages.map((message, index) => <div key={`${message.createdAt}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${message.role === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-secondary"}`}><p className="whitespace-pre-wrap">{message.content}</p><p className={`mt-1 text-[10px] ${message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p></div></div>)}{busy && <div className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground"><span className="animate-pulse">Assistant is typing...</span></div>}{error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{error}</div>}</div></ScrollArea>
        {messages.length <= 1 && <div className="flex gap-1.5 overflow-x-auto px-3 pb-2">{prompts.map(prompt => <Button key={prompt} size="sm" variant="outline" className="h-7 shrink-0 text-[11px]" onClick={() => send(prompt)}>{prompt}</Button>)}</div>}
        <div className="border-t border-border p-3"><div className="flex gap-2"><Input value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter") send(); }} placeholder="Ask about Camplink..." maxLength={4000} /><Button size="icon" className="gradient-accent shrink-0" onClick={() => send()} disabled={busy || !input.trim()} aria-label="Send message"><Send className="h-4 w-4" /></Button></div><button type="button" onClick={openSupport} className="mt-2 flex w-full items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-primary"><MessageCircle className="h-3 w-3" />Chat support <ExternalLink className="h-3 w-3" /></button></div>
      </div>}
      <Button onClick={() => setOpen(value => !value)} className="fixed bottom-4 right-4 z-[100] h-12 rounded-full gradient-accent px-4 shadow-xl" aria-label="Open Camplink Assistant"><Bot className="mr-2 h-6 w-6" /><span className="text-xs font-bold">Ask Camplink</span></Button>
    </>
  );
};
