import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Plus, UserCog } from "lucide-react";

type Profile = { id: string; email: string; full_name: string | null; role: string; created_at: string };

export default function Configuration() {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", full_name: "", role: "user" });
  const [saving, setSaving] = useState(false);

  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at");
    setProfiles((data as Profile[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchProfiles(); }, []);

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password) {
      return toast({ title: "Email y contraseña son requeridos", variant: "destructive" });
    }
    setSaving(true);
    // Sign up user
    const { data, error } = await supabase.auth.signUp({
      email: newUser.email,
      password: newUser.password,
      options: { data: { full_name: newUser.full_name } },
    });
    if (error) {
      toast({ title: "Error al crear usuario", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    // Assign role if admin
    if (data.user && newUser.role === "admin") {
      await supabase.from("user_roles").insert({ user_id: data.user.id, role: "admin" });
    }
    toast({ title: "Usuario creado. Debe verificar su email para poder ingresar." });
    setDialogOpen(false);
    setNewUser({ email: "", password: "", full_name: "", role: "user" });
    setSaving(false);
    fetchProfiles();
  };

  const handleRoleChange = async (profileId: string, newRole: string) => {
    if (newRole === "admin") {
      await supabase.from("user_roles").upsert({ user_id: profileId, role: "admin" });
    } else {
      await supabase.from("user_roles").delete().eq("user_id", profileId).eq("role", "admin");
    }
    toast({ title: "Rol actualizado" });
    fetchProfiles();
  };

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Configuración</h1>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <UserCog className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Solo los administradores pueden acceder a esta sección.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuración</h1>
          <p className="text-sm text-muted-foreground">Gestión de usuarios del sistema</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nuevo Usuario
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuarios del sistema</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Cargando usuarios...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  {isAdmin && <TableHead>Cambiar Rol</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.full_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email}</TableCell>
                    <TableCell>
                      <Badge variant={p.role === "admin" ? "default" : "secondary"}>{p.role}</Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        {p.id !== user?.id ? (
                          <Select defaultValue={p.role} onValueChange={v => handleRoleChange(p.id, v)}>
                            <SelectTrigger className="w-32 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">Usuario</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground">(tú)</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre completo</Label>
              <Input value={newUser.full_name} onChange={e => setNewUser(u => ({ ...u, full_name: e.target.value }))} placeholder="Juan García" />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} placeholder="usuario@empresa.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Contraseña *</Label>
              <Input type="password" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={newUser.role} onValueChange={v => setNewUser(u => ({ ...u, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuario</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={saving}>{saving ? "Creando..." : "Crear Usuario"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
