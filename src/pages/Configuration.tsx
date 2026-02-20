import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, UserCog, Upload, Download, FileSpreadsheet, Trash2 } from "lucide-react";

const CATEGORIAS = ["SPC", "Porcelanato", "Adhesivos", "Zócalos", "Otros"];
const UNIDADES = ["m2", "cajas", "unidades", "kg", "litros"];

type Profile = { id: string; email: string; full_name: string | null; role: string; created_at: string };

export default function Configuration() {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", full_name: "", role: "user" });
  const [saving, setSaving] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at");
    setProfiles((data as Profile[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchProfiles(); }, []);

  // ── CSV Catálogo: Exportar ─────────────────────────────────
  const handleExportCatalogo = async () => {
    const { data } = await supabase.from("products").select("nombre,categoria,unidad,stock_minimo").order("nombre");
    if (!data) return;
    const header = "nombre,categoria,unidad,stock_minimo";
    const rows = data.map(p => [p.nombre, p.categoria, p.unidad, p.stock_minimo ?? ""].join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `floortek-catalogo-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Catálogo exportado correctamente" });
  };

  // ── CSV Catálogo: Importar ─────────────────────────────────
  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const handleImportCatalogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n").slice(1);
    let ok = 0, failed = 0;
    for (const line of lines) {
      if (!line.trim()) continue;
      const [nombre, categoria, unidad, stock_minimo] = parseCSVLine(line);
      if (!nombre) continue;
      const { error } = await supabase.from("products").upsert({
        nombre: nombre.trim(),
        categoria: CATEGORIAS.includes(categoria?.trim()) ? categoria.trim() : "Otros",
        unidad: UNIDADES.includes(unidad?.trim()) ? unidad.trim() : "m2",
        stock_minimo: stock_minimo?.trim() ? Number(stock_minimo.trim().replace(",", ".")) : null,
      }, { onConflict: "nombre" });
      if (error) { failed++; console.error(`Error importando "${nombre}":`, error.message); }
      else ok++;
    }
    toast({ title: `Catálogo importado: ${ok} producto${ok !== 1 ? "s" : ""} cargado${ok !== 1 ? "s" : ""}${failed > 0 ? `, ${failed} errores` : ""}` });
    if (fileRef.current) fileRef.current.value = "";
    fetchProfiles();
  };

  // ── Borrar todos los productos ────────────────────────────
  const handleDeleteAllProducts = async () => {
    setDeletingAll(true);
    const { error } = await supabase.from("products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      toast({ title: "Error al borrar productos", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Todos los productos fueron eliminados" });
    }
    setDeletingAll(false);
    setDeleteAllOpen(false);
  };

  // ── Usuarios ───────────────────────────────────────────────
  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password) {
      return toast({ title: "Email y contraseña son requeridos", variant: "destructive" });
    }
    setSaving(true);
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
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-muted-foreground">Gestión de usuarios y catálogo de productos</p>
      </div>

      {/* Catálogo de Productos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Catálogo de Productos
          </CardTitle>
          <CardDescription>
            Importá o exportá el listado de productos (nombre, categoría, unidad y stock mínimo). El stock actual no se modifica al importar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleExportCatalogo}>
              <Download className="w-4 h-4 mr-1.5" /> Exportar catálogo CSV
            </Button>
            <Button size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1.5" /> Importar catálogo CSV
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteAllOpen(true)}>
              <Trash2 className="w-4 h-4 mr-1.5" /> Borrar todos los productos
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImportCatalogo} />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Formato del CSV: <code className="bg-muted px-1 py-0.5 rounded text-xs">nombre,categoria,unidad,stock_minimo</code>
          </p>
        </CardContent>
      </Card>

      {/* Usuarios */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">Usuarios del sistema</CardTitle>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nuevo Usuario
          </Button>
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

      {/* Confirmar borrar todos los productos */}
      <AlertDialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar todos los productos?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente todos los productos y sus movimientos asociados. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAllProducts}
              disabled={deletingAll}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deletingAll ? "Borrando..." : "Sí, borrar todo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog nuevo usuario */}
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
