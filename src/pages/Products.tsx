import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Upload, Search, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type Product = {
  id: string; nombre: string; categoria: string; unidad: string;
  stock_actual: number; stock_minimo: number | null; created_at: string;
};

const CATEGORIAS = ["SPC", "Porcelanato", "Adhesivos", "Zócalos", "Otros"];
const UNIDADES = ["m2", "cajas", "unidades", "kg", "litros"];

const emptyForm = { nombre: "", categoria: "SPC", unidad: "m2", stock_actual: 0, stock_minimo: "" as string | number };

export default function Products() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("*").order("nombre");
    setProducts(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const filtered = products.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.categoria.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ nombre: p.nombre, categoria: p.categoria, unidad: p.unidad, stock_actual: p.stock_actual, stock_minimo: p.stock_minimo ?? "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) return toast({ title: "El nombre es obligatorio", variant: "destructive" });
    setSaving(true);
    const payload = {
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      unidad: form.unidad,
      stock_actual: Number(form.stock_actual),
      stock_minimo: form.stock_minimo !== "" ? Number(form.stock_minimo) : null,
    };

    if (editing) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) {
        toast({ title: "Error al actualizar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Producto actualizado" });
        setDialogOpen(false);
        fetchProducts();
      }
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) {
        const msg = error.message.includes("unique") ? "Ya existe un producto con ese nombre." : error.message;
        toast({ title: "Error al crear", description: msg, variant: "destructive" });
      } else {
        toast({ title: "Producto creado" });
        setDialogOpen(false);
        fetchProducts();
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("products").delete().eq("id", deleteId);
    if (error) toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    else { toast({ title: "Producto eliminado" }); fetchProducts(); }
    setDeleteId(null);
  };

  const handleCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.trim().split("\n").slice(1); // skip header
    let ok = 0, failed = 0;
    for (const line of lines) {
      const [nombre, categoria, unidad, stock_actual, stock_minimo] = line.split(",").map(s => s.trim().replace(/^"|"$/g, ""));
      if (!nombre) continue;
      const { error } = await supabase.from("products").insert({
        nombre, categoria: categoria || "Otros", unidad: unidad || "m2",
        stock_actual: Number(stock_actual) || 0,
        stock_minimo: stock_minimo ? Number(stock_minimo) : null,
      });
      error ? failed++ : ok++;
    }
    toast({ title: `CSV importado: ${ok} productos cargados${failed > 0 ? `, ${failed} errores` : ""}` });
    fetchProducts();
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-sm text-muted-foreground">{products.length} productos registrados</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" /> Importar CSV
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> Nuevo Producto
            </Button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por nombre o categoría..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Cargando productos...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {search ? "No hay productos que coincidan con la búsqueda." : "No hay productos cargados aún."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="text-right">Stock Actual</TableHead>
                  <TableHead className="text-right">Stock Mínimo</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                  {isAdmin && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => {
                  const isLow = p.stock_minimo !== null && p.stock_actual <= p.stock_minimo;
                  return (
                    <TableRow key={p.id} className={isLow ? "bg-destructive/5" : ""}>
                      <TableCell className="font-medium">{p.nombre}</TableCell>
                      <TableCell><Badge variant="secondary">{p.categoria}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{p.unidad}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {Number(p.stock_actual).toLocaleString("es-AR")}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground font-mono">
                        {p.stock_minimo !== null ? Number(p.stock_minimo).toLocaleString("es-AR") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {isLow ? (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertTriangle className="w-3 h-3" /> Bajo mínimo
                          </Badge>
                        ) : (
                          <Badge className="text-xs bg-primary/10 text-primary border-0">OK</Badge>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Product form dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Roble Gris SPC" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Unidad</Label>
                <Select value={form.unidad} onValueChange={v => setForm(f => ({ ...f, unidad: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Stock Inicial</Label>
                <Input type="number" min={0} value={form.stock_actual} onChange={e => setForm(f => ({ ...f, stock_actual: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Stock Mínimo</Label>
                <Input type="number" min={0} value={form.stock_minimo} onChange={e => setForm(f => ({ ...f, stock_minimo: e.target.value }))} placeholder="Opcional" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminarán también todos los movimientos asociados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
