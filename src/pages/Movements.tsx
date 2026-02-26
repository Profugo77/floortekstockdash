import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Mic, Search, X, TrendingUp, TrendingDown, RefreshCw, Trash2, History } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import VoiceCard from "@/components/VoiceCard";

type Product = { id: string; nombre: string; stock_actual: number; unidad: string };
type Movement = {
  id: string; product_id: string; tipo: string; cantidad: number; fecha: string;
  observaciones: string | null; created_at: string; user_id: string;
  products: { nombre: string; unidad: string } | null;
};
type ProfileMap = Record<string, { full_name: string | null; email: string }>;
type DeletedMovement = {
  id: string; original_movement_id: string; product_name: string; tipo: string;
  cantidad: number; fecha: string; observaciones: string | null;
  original_user_id: string; deleted_by: string; deleted_at: string;
};

type MovementType = "entrada" | "salida" | "ajuste";

const emptyForm = { product_id: "", tipo: "entrada" as MovementType, cantidad: 1, fecha: format(new Date(), "yyyy-MM-dd"), observaciones: "" };

// Searchable product combobox
function ProductSearch({ products, value, onChange }: {
  products: Product[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = products.find(p => p.id === value);
  const filtered = query.length > 0
    ? products.filter(p => p.nombre.toLowerCase().includes(query.toLowerCase())).slice(0, 20)
    : products.slice(0, 20);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (p: Product) => {
    onChange(p.id);
    setQuery(p.nombre);
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setQuery("");
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (!value) setQuery("");
    else if (selected) setQuery(selected.nombre);
  }, [value, selected]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); onChange(""); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar producto..."
          className="pl-8 pr-8"
        />
        {query && (
          <button onClick={handleClear} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</div>
          ) : (
            filtered.map(p => (
              <button
                key={p.id}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex justify-between items-center gap-2"
                onMouseDown={e => { e.preventDefault(); handleSelect(p); }}
              >
                <span className="truncate">{p.nombre}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {Number(p.stock_actual).toLocaleString("es-AR")} {p.unidad}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function MovementTypeBadge({ tipo }: { tipo: string }) {
  if (tipo === "entrada") {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 gap-1">
        <TrendingUp className="w-3 h-3" /> Entrada
      </Badge>
    );
  }
  if (tipo === "salida") {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 gap-1">
        <TrendingDown className="w-3 h-3" /> Salida
      </Badge>
    );
  }
  return (
    <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 gap-1">
      <RefreshCw className="w-3 h-3" /> Ajuste
    </Badge>
  );
}

export default function Movements() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [deletedMovements, setDeletedMovements] = useState<DeletedMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [filterProduct, setFilterProduct] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [showVoice, setShowVoice] = useState(false);
  const [profileMap, setProfileMap] = useState<ProfileMap>({});
  const [deleteTarget, setDeleteTarget] = useState<Movement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    const [productsRes, movementsRes, profilesRes, deletedRes] = await Promise.all([
      supabase.from("products").select("id, nombre, stock_actual, unidad").order("nombre"),
      supabase.from("movements").select("id, product_id, tipo, cantidad, fecha, observaciones, created_at, user_id, products(nombre, unidad)").order("created_at", { ascending: false }).limit(200),
      supabase.from("profiles").select("id, full_name, email"),
      supabase.from("deleted_movements").select("*").order("deleted_at", { ascending: false }).limit(100),
    ]);
    setProducts(productsRes.data || []);
    setMovements((movementsRes.data as Movement[]) || []);
    setDeletedMovements((deletedRes.data as DeletedMovement[]) || []);
    const map: ProfileMap = {};
    for (const p of (profilesRes.data || [])) { map[p.id] = { full_name: p.full_name, email: p.email }; }
    setProfileMap(map);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = movements.filter(m => {
    if (filterProduct !== "all" && !m.products?.nombre.includes(filterProduct)) return false;
    if (filterDate && m.fecha !== filterDate) return false;
    return true;
  });

  const handleSave = async () => {
    if (!form.product_id) return toast({ title: "Seleccioná un producto", variant: "destructive" });
    setSaving(true);
    const { error } = await supabase.from("movements").insert({
      product_id: form.product_id,
      tipo: form.tipo,
      cantidad: form.cantidad,
      fecha: form.fecha,
      observaciones: form.observaciones || null,
      user_id: user!.id,
    });
    setSaving(false);
    if (error) {
      const selectedProduct = products.find(p => p.id === form.product_id);
      const msg = error.message.includes("Stock insuficiente") 
        ? `Stock insuficiente. ${selectedProduct?.nombre ?? "El producto"} tiene ${selectedProduct ? Number(selectedProduct.stock_actual).toLocaleString("es-AR") + " " + selectedProduct.unidad : "0"} disponibles.` 
        : error.message;
      toast({ title: "Error al registrar", description: msg, variant: "destructive" });
    } else {
      const labels: Record<string, string> = { entrada: "Entrada", salida: "Salida", ajuste: "Ajuste" };
      toast({ title: `${labels[form.tipo]} registrada correctamente` });
      setDialogOpen(false);
      setForm({ ...emptyForm });
      fetchData();
    }
  };

  const handleVoiceConfirm = async (productId: string, tipo: "entrada" | "salida", cantidad: number) => {
    const { error } = await supabase.from("movements").insert({
      product_id: productId, tipo, cantidad, fecha: format(new Date(), "yyyy-MM-dd"),
      observaciones: "Registrado por voz", user_id: user!.id,
    });
    if (error) {
      const msg = error.message.includes("Stock insuficiente") ? "Stock insuficiente." : error.message;
      toast({ title: "Error", description: msg, variant: "destructive" });
    } else {
      toast({ title: `${tipo === "entrada" ? "Entrada" : "Salida"} por voz registrada` });
      setShowVoice(false);
      fetchData();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    // Save to history first
    const { error: histError } = await supabase.from("deleted_movements").insert({
      original_movement_id: deleteTarget.id,
      product_id: deleteTarget.product_id,
      product_name: deleteTarget.products?.nombre || "Desconocido",
      tipo: deleteTarget.tipo,
      cantidad: deleteTarget.cantidad,
      fecha: deleteTarget.fecha,
      observaciones: deleteTarget.observaciones,
      original_user_id: deleteTarget.user_id,
      deleted_by: user!.id,
    });
    if (histError) {
      toast({ title: "Error al registrar eliminación", description: histError.message, variant: "destructive" });
      setDeleting(false);
      return;
    }
    // Now delete the movement (trigger will reverse stock)
    const { error } = await supabase.from("movements").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Movimiento eliminado y registrado en historial" });
      setDeleteTarget(null);
      fetchData();
    }
  };

  // We need product_id from the movement for delete history - fetch it from the raw query
  // Actually movements query doesn't return product_id directly, let me fix:
  // The movements select includes products(nombre, unidad) but not product_id explicitly.
  // Let me add it. For now, we can get it from products join. Actually supabase returns all columns by default when we use select with specific fields... Let me check.
  // We need to add product_id to the select.

  const getButtonClass = (tipo: MovementType) => {
    if (tipo === "entrada") return "bg-green-500 hover:bg-green-600";
    if (tipo === "salida") return "bg-red-500 hover:bg-red-600";
    return "bg-blue-500 hover:bg-blue-600";
  };

  const getButtonLabel = (tipo: MovementType) => {
    const labels: Record<string, string> = { entrada: "Registrar Entrada", salida: "Registrar Salida", ajuste: "Registrar Ajuste" };
    return saving ? "Guardando..." : labels[tipo];
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Movimientos</h1>
          <p className="text-sm text-muted-foreground">{movements.length} movimientos registrados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowVoice(true)}>
            <Mic className="w-4 h-4 mr-1" /> Voz con IA
          </Button>
          <Button size="sm" onClick={() => { setForm({ ...emptyForm }); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Nuevo Movimiento
          </Button>
        </div>
      </div>

      <Tabs defaultValue="movements">
        <TabsList>
          <TabsTrigger value="movements">Movimientos</TabsTrigger>
          <TabsTrigger value="deleted" className="gap-1">
            <History className="w-3.5 h-3.5" /> Eliminados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="movements" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Todos los productos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los productos</SelectItem>
                {products.map(p => <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" className="w-44" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
            {(filterProduct !== "all" || filterDate) && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterProduct("all"); setFilterDate(""); }}>
                Limpiar filtros
              </Button>
            )}
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Cargando movimientos...</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No hay movimientos que coincidan.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Observaciones</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(m => {
                      const profile = profileMap[m.user_id];
                      const userName = profile?.full_name || profile?.email || "—";
                      const canDelete = m.user_id === user?.id || isAdmin;
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{m.fecha}</TableCell>
                          <TableCell className="font-medium">{m.products?.nombre ?? "—"}</TableCell>
                          <TableCell><MovementTypeBadge tipo={m.tipo} /></TableCell>
                          <TableCell className={`text-right font-mono font-semibold ${
                            m.tipo === "entrada" ? "text-green-600 dark:text-green-400" 
                            : m.tipo === "salida" ? "text-red-600 dark:text-red-400"
                            : "text-blue-600 dark:text-blue-400"
                          }`}>
                            {m.tipo === "entrada" ? "+" : m.tipo === "salida" ? "-" : "="}{Number(m.cantidad).toLocaleString("es-AR")} {m.products?.unidad}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{userName}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{m.observaciones || "—"}</TableCell>
                          <TableCell>
                            {canDelete && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(m)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deleted" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {deletedMovements.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No hay movimientos eliminados.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Eliminado</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead>Fecha orig.</TableHead>
                      <TableHead>Eliminado por</TableHead>
                      <TableHead>Obs.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deletedMovements.map(dm => {
                      const deletedByProfile = profileMap[dm.deleted_by];
                      const deletedByName = deletedByProfile?.full_name || deletedByProfile?.email || "—";
                      return (
                        <TableRow key={dm.id} className="opacity-70">
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(dm.deleted_at), "dd/MM/yy HH:mm")}
                          </TableCell>
                          <TableCell className="font-medium">{dm.product_name}</TableCell>
                          <TableCell><MovementTypeBadge tipo={dm.tipo} /></TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {Number(dm.cantidad).toLocaleString("es-AR")}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{dm.fecha}</TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{deletedByName}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{dm.observaciones || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New movement dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle>Registrar Movimiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Producto *</Label>
              <ProductSearch
                products={products}
                value={form.product_id}
                onChange={v => setForm(f => ({ ...f, product_id: v }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, tipo: "entrada" }))}
                    className={`flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-sm font-medium transition-colors
                      ${form.tipo === "entrada"
                        ? "bg-green-500 text-white border-green-500"
                        : "bg-background text-muted-foreground border-border hover:bg-green-50 hover:text-green-700 hover:border-green-300 dark:hover:bg-green-900/20"
                      }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" /> Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, tipo: "salida" }))}
                    className={`flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-sm font-medium transition-colors
                      ${form.tipo === "salida"
                        ? "bg-red-500 text-white border-red-500"
                        : "bg-background text-muted-foreground border-border hover:bg-red-50 hover:text-red-700 hover:border-red-300 dark:hover:bg-red-900/20"
                      }`}
                  >
                    <TrendingDown className="w-3.5 h-3.5" /> Salida
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, tipo: "ajuste" }))}
                    className={`flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-sm font-medium transition-colors
                      ${form.tipo === "ajuste"
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-background text-muted-foreground border-border hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:hover:bg-blue-900/20"
                      }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Ajuste
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{form.tipo === "ajuste" ? "Stock real" : "Cantidad"}</Label>
                <Input type="number" min={form.tipo === "ajuste" ? 0 : 1} value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Observaciones</Label>
              <Textarea value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} placeholder="Opcional" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className={getButtonClass(form.tipo)}>
              {getButtonLabel(form.tipo)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  <span className="font-medium">{deleteTarget.products?.nombre}</span> — {deleteTarget.tipo} de {Number(deleteTarget.cantidad).toLocaleString("es-AR")} ({deleteTarget.fecha})
                  <br />
                  El stock se revertirá automáticamente y el movimiento quedará registrado en el historial de eliminados.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Voice dialog */}
      {showVoice && (
        <VoiceCard products={products} onConfirm={handleVoiceConfirm} onClose={() => setShowVoice(false)} />
      )}
    </div>
  );
}
