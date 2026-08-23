import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, ArrowLeft, Trash2, Users, MessageCircle, Lock } from "lucide-react";
import { toast } from "sonner";
import { useContactUnlock } from "@/hooks/useContactUnlock";
import { ContactUnlockDialog } from "@/components/ContactUnlockDialog";

type Conv = { id: string; user_a: string; user_b: string; last_message_at: string; is_support?: boolean; other?: { id: string; display_name: string | null } };
type Msg = { id: string; conversation_id: string; sender_id: string; content: string; created_at: string };
type Group = { id: string; name: string; description: string | null; avatar_url: string | null; last_message_at: string };
type GMsg = { id: string; group_id: string; sender_id: string; content: string; created_at: string; sender_name?: string };

const Chat = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const activeId = params.get("c");
  const activeGroup = params.get("g");
  const wantsSupport = params.get("support") === "1";
  const [convos, setConvos] = useState<Conv[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [gmessages, setGmessages] = useState<GMsg[]>([]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const activeConv = convos.find(c => c.id === activeId);
  const otherId = activeConv?.other?.id;
  const { unlocked: dmUnlocked, refresh: refreshUnlock } = useContactUnlock(otherId);

  useEffect(() => { document.title = "Chat — Camplink"; }, []);

  const loadConvos = async () => {
    if (!user) return;
    const { data } = await supabase.from("conversations").select("*").or(`user_a.eq.${user.id},user_b.eq.${user.id}`).order("last_message_at", { ascending: false });
    const list = (data ?? []) as Conv[];
    const otherIds = list.map(c => (c.user_a === user.id ? c.user_b : c.user_a));
    if (otherIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", otherIds);
      const map = new Map(profs?.map(p => [p.id, p]));
      list.forEach(c => { const oid = c.user_a === user.id ? c.user_b : c.user_a; c.other = map.get(oid) as any ?? { id: oid, display_name: null }; });
    }
    setConvos(list);
  };

  const loadGroups = async () => {
    const { data } = await (supabase as any).from("chat_groups").select("*").order("last_message_at", { ascending: false });
    setGroups(data ?? []);
  };

  const loadMessages = async () => {
    if (!activeId) { setMessages([]); return; }
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", activeId).order("created_at");
    setMessages((data ?? []) as Msg[]);
  };

  const loadGMessages = async () => {
    if (!activeGroup) { setGmessages([]); return; }
    const { data } = await (supabase as any).from("group_messages").select("*").eq("group_id", activeGroup).order("created_at");
    const list = (data ?? []) as GMsg[];
    const ids = Array.from(new Set(list.map(m => m.sender_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", ids);
      const map = new Map(profs?.map(p => [p.id, p.display_name]));
      list.forEach(m => { m.sender_name = map.get(m.sender_id) ?? "User"; });
    }
    setGmessages(list);
  };

  useEffect(() => { loadConvos(); loadGroups(); }, [user]);
  useEffect(() => {
    if (!user || !wantsSupport || activeId) return;
    (supabase.rpc as any)("open_support_chat").then(({ data, error }: any) => {
      if (error) toast.error(error.message);
      else if (data) setParams({ c: String(data) });
    });
  }, [user?.id, wantsSupport, activeId]);
  useEffect(() => { loadMessages(); }, [activeId]);
  useEffect(() => { loadGMessages(); }, [activeGroup]);

  useEffect(() => {
    if (!activeId) return;
    const ch = supabase.channel(`msgs-${activeId}`).on("postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
      (p) => setMessages(m => [...m, p.new as Msg])
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId]);

  useEffect(() => {
    if (!activeGroup) return;
    const ch = supabase.channel(`gmsgs-${activeGroup}`).on("postgres_changes",
      { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${activeGroup}` },
      async (p) => {
        const m = p.new as GMsg;
        const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", m.sender_id).maybeSingle();
        m.sender_name = prof?.display_name ?? "User";
        setGmessages(prev => [...prev, m]);
      }
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeGroup]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, gmessages]);

  const send = async () => {
    if (!input.trim() || !user) return;
    const content = input.trim().slice(0, 2000);
    setInput("");
    if (activeId) {
      const { error } = await supabase.from("messages").insert({ conversation_id: activeId, sender_id: user.id, content });
      if (!error) await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", activeId);
    } else if (activeGroup) {
      const { error } = await (supabase as any).from("group_messages").insert({ group_id: activeGroup, sender_id: user.id, content });
      if (!error) await (supabase as any).from("chat_groups").update({ last_message_at: new Date().toISOString() }).eq("id", activeGroup);
    }
  };

  const deleteMessage = async (id: string, group = false) => {
    if (!confirm("Delete this message?")) return;
    const table = group ? "group_messages" : "messages";
    const { error } = await (supabase as any).from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (group) setGmessages(m => m.filter(x => x.id !== id));
    else setMessages(m => m.filter(x => x.id !== id));
  };

  const deleteConversation = async (id: string) => {
    if (!confirm("Delete this entire chat?")) return;
    await supabase.from("messages").delete().eq("conversation_id", id);
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Chat deleted");
    setParams({});
    loadConvos();
  };

  if (activeId) {
    const conv = activeConv;
    const unlocked = !!conv?.is_support || dmUnlocked;
    const refresh = refreshUnlock;
    return (
      <AppShell>
        <div className="flex items-center gap-3 mb-3">
          <Button size="icon" variant="ghost" onClick={() => setParams({})}><ArrowLeft className="h-5 w-5" /></Button>
          <Avatar><AvatarFallback className="bg-primary/20 text-primary">{(conv?.other?.display_name ?? "U").slice(0,2).toUpperCase()}</AvatarFallback></Avatar>
          <p className="font-semibold flex-1">{conv?.is_support ? "Chat support" : conv?.other?.display_name ?? "Chat"}</p>
          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteConversation(activeId)} title="Delete chat"><Trash2 className="h-4 w-4" /></Button>
        </div>
        <Card className="gradient-card h-[60vh] flex flex-col">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {!unlocked && otherId && (
                <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 text-center space-y-2">
                <Lock className="h-6 w-6 mx-auto text-primary" />
                <p className="text-sm font-semibold">Chat is locked</p>
                  <p className="text-xs text-muted-foreground">Unlock this user's contact to send and read messages.</p>
                <ContactUnlockDialog sellerId={otherId} sellerName={conv?.other?.display_name ?? undefined} onUnlocked={refresh} />
              </div>
            )}
            {unlocked && messages.map(m => (
              <div key={m.id} className={`group flex items-center gap-1 ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}>
                {m.sender_id === user?.id && (
                  <button onClick={() => deleteMessage(m.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive p-1" title="Delete"><Trash2 className="h-3 w-3" /></button>
                )}
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.sender_id === user?.id ? "gradient-accent text-primary-foreground" : "bg-secondary"}`}>{m.content}</div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="p-2 border-t border-border flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder={unlocked ? "Type a message…" : "Unlock to chat"}
              disabled={!unlocked}
            />
            <Button onClick={send} className="gradient-accent" size="icon" disabled={!unlocked}><Send className="h-4 w-4" /></Button>
          </div>
        </Card>
      </AppShell>
    );
  }

  if (activeGroup) {
    const g = groups.find(x => x.id === activeGroup);
    return (
      <AppShell>
        <div className="flex items-center gap-3 mb-3">
          <Button size="icon" variant="ghost" onClick={() => setParams({})}><ArrowLeft className="h-5 w-5" /></Button>
          <Avatar>{g?.avatar_url && <AvatarImage src={g.avatar_url} />}<AvatarFallback className="bg-primary/20 text-primary"><Users className="h-4 w-4" /></AvatarFallback></Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{g?.name ?? "Group"}</p>
            {g?.description && <p className="text-[10px] text-muted-foreground truncate">{g.description}</p>}
          </div>
        </div>
        <Card className="gradient-card h-[60vh] flex flex-col">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {gmessages.map(m => (
              <div key={m.id} className={`group flex items-end gap-1 ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}>
                {m.sender_id === user?.id && (
                  <button onClick={() => deleteMessage(m.id, true)} className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive p-1"><Trash2 className="h-3 w-3" /></button>
                )}
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.sender_id === user?.id ? "gradient-accent text-primary-foreground" : "bg-secondary"}`}>
                  {m.sender_id !== user?.id && <p className="text-[10px] font-semibold opacity-70 mb-0.5">{m.sender_name}</p>}
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="p-2 border-t border-border flex gap-2">
            <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Message the group…" />
            <Button onClick={send} className="gradient-accent" size="icon"><Send className="h-4 w-4" /></Button>
          </div>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-extrabold mb-4">💬 Chats</h1>
      <Tabs defaultValue="dms">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="dms"><MessageCircle className="h-3 w-3 mr-1" />Direct ({convos.length})</TabsTrigger>
          <TabsTrigger value="groups"><Users className="h-3 w-3 mr-1" />Groups ({groups.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="dms" className="mt-3 space-y-2">
          {convos.length === 0 ? (
            <Card className="p-8 text-center gradient-card text-muted-foreground">No conversations yet. Start one from a listing!</Card>
          ) : convos.map(c => (
            <Card key={c.id} className="p-3 gradient-card hover:shadow-glow transition-smooth flex items-center gap-3">
              <div className="flex items-center gap-3 flex-1 cursor-pointer min-w-0" onClick={() => setParams({ c: c.id })}>
                <Avatar><AvatarFallback className="bg-primary/20 text-primary">{(c.other?.display_name ?? "U").slice(0,2).toUpperCase()}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{c.is_support ? "Chat support" : c.other?.display_name ?? "User"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(c.last_message_at).toLocaleString()}</p>
                </div>
              </div>
              <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => deleteConversation(c.id)} title="Delete chat"><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="groups" className="mt-3 space-y-2">
          {groups.length === 0 ? (
            <Card className="p-8 text-center gradient-card text-muted-foreground">No groups yet — admins can create them.</Card>
          ) : groups.map(g => (
            <Card key={g.id} className="p-3 gradient-card hover:shadow-glow transition-smooth flex items-center gap-3 cursor-pointer" onClick={() => setParams({ g: g.id })}>
              <Avatar>{g.avatar_url && <AvatarImage src={g.avatar_url} />}<AvatarFallback className="bg-primary/20 text-primary"><Users className="h-4 w-4" /></AvatarFallback></Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{g.name}</p>
                {g.description && <p className="text-xs text-muted-foreground truncate">{g.description}</p>}
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
};

export default Chat;
