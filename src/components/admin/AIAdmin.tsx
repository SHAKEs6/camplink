import { useEffect, useState } from "react";
import { Bot, Save, Trash2, Plus, BarChart3, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Knowledge = { id: string; title: string; content: string; enabled: boolean };
type Conversation = { id: string; user_id: string | null; updated_at: string };
export const AIAdmin = () => {
  const [enabled, setEnabled] = useState(true);
  const [welcome, setWelcome] = useState("");
  const [supportUrl, setSupportUrl] = useState("/chat");
  const [items, setItems] = useState<Knowledge[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [conversationCount, setConversationCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedMessages, setSelectedMessages] = useState<Array<{ role: string; content: string }>>([]);

  const load = async () => {
    const [{ data: settings }, { data: knowledge }, { count: conversationTotal }, { count: messages }, { data: recentConversations }] = await Promise.all([
      (supabase as any).from("ai_settings").select("enabled,welcome_message,support_url").eq("id", true).maybeSingle(),
      (supabase as any).from("ai_knowledge").select("id,title,content,enabled").order("created_at", { ascending: false }),
      (supabase as any).from("ai_conversations").select("id", { count: "exact", head: true }),
      (supabase as any).from("ai_messages").select("id", { count: "exact", head: true }),
      (supabase as any).from("ai_conversations").select("id,user_id,updated_at").order("updated_at", { ascending: false }).limit(10),
    ]);
    setEnabled(settings?.enabled ?? true); setWelcome(settings?.welcome_message ?? ""); setSupportUrl(settings?.support_url ?? "/chat"); setItems((knowledge ?? []) as Knowledge[]); setConversationCount(conversationTotal ?? 0); setMessageCount(messages ?? 0); setConversations((recentConversations ?? []) as Conversation[]);
  };
  useEffect(() => { load(); }, []);

  const saveSettings = async () => {
    const { error } = await (supabase as any).from("ai_settings").upsert({ id: true, enabled, welcome_message: welcome.trim(), support_url: supportUrl.trim() || "/chat" });
    if (error) toast.error(error.message); else toast.success("Assistant settings saved");
  };
  const addKnowledge = async () => {
    if (!title.trim() || !content.trim()) return toast.error("Title and verified information are required");
    const { error } = await (supabase as any).from("ai_knowledge").insert({ title: title.trim(), content: content.trim() });
    if (error) toast.error(error.message); else { setTitle(""); setContent(""); toast.success("Knowledge added"); load(); }
  };
  const toggleKnowledge = async (item: Knowledge) => {
    const { error } = await (supabase as any).from("ai_knowledge").update({ enabled: !item.enabled }).eq("id", item.id);
    if (error) toast.error(error.message); else load();
  };
  const removeKnowledge = async (id: string) => {
    if (!confirm("Delete this knowledge entry?")) return;
    const { error } = await (supabase as any).from("ai_knowledge").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  const openConversation = async (id: string) => {
    const { data } = await (supabase as any).from("ai_messages").select("role,content").eq("conversation_id", id).order("created_at", { ascending: true });
    setSelectedMessages((data ?? []) as Array<{ role: string; content: string }>);
  };

  return <div className="space-y-4">
    <Card className="gradient-card p-4 space-y-3"><div className="flex items-center justify-between"><p className="flex items-center gap-2 font-semibold text-sm"><Bot className="h-4 w-4" />Assistant controls</p><Switch checked={enabled} onCheckedChange={setEnabled} /></div><div><Label className="text-xs">Welcome message</Label><Textarea value={welcome} onChange={event => setWelcome(event.target.value)} rows={3} /></div><div><Label className="text-xs">Support link</Label><Input value={supportUrl} onChange={event => setSupportUrl(event.target.value)} placeholder="/chat" /></div><Button className="w-full gradient-accent" onClick={saveSettings}><Save className="mr-1 h-4 w-4" />Save settings</Button></Card>
    <Card className="gradient-card p-4"><p className="mb-3 flex items-center gap-2 font-semibold text-sm"><BarChart3 className="h-4 w-4" />Usage overview</p><div className="grid grid-cols-2 gap-2 text-center"><div className="rounded-lg border p-3"><p className="text-2xl font-bold">{conversationCount}</p><p className="text-xs text-muted-foreground">Conversations</p></div><div className="rounded-lg border p-3"><p className="text-2xl font-bold">{messageCount}</p><p className="text-xs text-muted-foreground">Messages</p></div></div></Card>
    <Card className="gradient-card p-4 space-y-2"><p className="flex items-center gap-2 font-semibold text-sm"><MessageSquare className="h-4 w-4" />Recent conversations</p>{conversations.map(conversation => <Button key={conversation.id} variant="outline" className="h-auto w-full justify-between py-2 text-left text-xs" onClick={() => openConversation(conversation.id)}><span className="truncate">{conversation.user_id ? `User ${conversation.user_id.slice(0, 8)}` : "Guest session"}</span><span>{new Date(conversation.updated_at).toLocaleDateString()}</span></Button>)}{selectedMessages.length > 0 && <div className="max-h-64 space-y-2 overflow-y-auto border-t border-border pt-2">{selectedMessages.map((message, index) => <div key={index} className="rounded-lg bg-secondary/50 p-2 text-xs"><span className="font-semibold capitalize">{message.role}: </span>{message.content}</div>)}</div>}</Card>
    <Card className="gradient-card p-4 space-y-3"><p className="font-semibold text-sm">Verified knowledge</p><div className="space-y-2"><Input value={title} onChange={event => setTitle(event.target.value)} placeholder="Topic title" /><Textarea value={content} onChange={event => setContent(event.target.value)} placeholder="Verified Camplink information" rows={3} /><Button className="w-full gradient-accent" onClick={addKnowledge}><Plus className="mr-1 h-4 w-4" />Add knowledge</Button></div>{items.map(item => <div key={item.id} className="flex items-start gap-2 border-t border-border pt-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.title}</p><p className="text-xs text-muted-foreground">{item.content}</p></div><Switch checked={item.enabled} onCheckedChange={() => toggleKnowledge(item)} /><Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeKnowledge(item.id)}><Trash2 className="h-4 w-4" /></Button></div>)}</Card>
  </div>;
};
