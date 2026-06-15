import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Users, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const GroupChatAdmin = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [avatar, setAvatar] = useState("");

  const load = async () => {
    const { data } = await (supabase as any).from("chat_groups").select("*").order("created_at", { ascending: false });
    setGroups(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim() || !user) { toast.error("Name required"); return; }
    const { error } = await (supabase as any).from("chat_groups").insert({
      name: name.trim(), description: desc.trim() || null, avatar_url: avatar.trim() || null, created_by: user.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Group created — visible to all users");
    setName(""); setDesc(""); setAvatar("");
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete group and all messages?")) return;
    const { error } = await (supabase as any).from("chat_groups").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  return (
    <div className="space-y-3">
      <Card className="gradient-card p-4 space-y-2">
        <p className="font-semibold text-sm flex items-center gap-2"><Users className="h-4 w-4" />Create group chat</p>
        <div><Label className="text-xs">Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Campus Buzz" /></div>
        <div><Label className="text-xs">Description (optional)</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} /></div>
        <div><Label className="text-xs">Avatar URL (optional)</Label><Input value={avatar} onChange={e => setAvatar(e.target.value)} placeholder="https://…" /></div>
        <Button className="gradient-accent w-full" onClick={create}><Plus className="h-4 w-4 mr-1" />Create Group</Button>
      </Card>

      <p className="text-xs text-muted-foreground">{groups.length} groups</p>
      {groups.map(g => (
        <Card key={g.id} className="p-3 gradient-card flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{g.name}</p>
            {g.description && <p className="text-xs text-muted-foreground truncate">{g.description}</p>}
          </div>
          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del(g.id)}><Trash2 className="h-4 w-4" /></Button>
        </Card>
      ))}
    </div>
  );
};
