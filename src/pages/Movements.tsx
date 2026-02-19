import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Mic, MicOff, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import VoiceCard from "@/components/VoiceCard";

type Product = { id: string; nombre: string; stock_actual: number; unidad: string };
type Movement = {
  id: string; tipo: string; cantidad: number; fecha: string;
  observaciones: string | null; created_at: string;
  products: { nombre: string; unidad: string } | null;
};

const emptyForm = { product_id: "", tipo: "entrada" as "entrada" | "salida", cantidad: 1, fecha: format(new Date(), "yyyy-MM-dd"), observaciones: "" };

export default function Movements() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [filterProduct, setFilterProduct] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [showVoice, setShowVoice] = useState(false);

  const fetchData = useCallback(async () => {
    const [productsRes, movementsRes] = await Promise.all([
      supabase.from("products").select("id, nombre, stock_actual, unidad").order("nombre"),
      supabase.from("movements").select("id, tipo, cantidad, fecha, observaciones, created_at, products(nombre, unidad)").order("created_at", { ascending: false }).limit(200),
    ]);
    setProducts(productsRes.data || []);
    setMovements((movementsRes.data as Movement[]) || []);
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
      const msg = error.message.includes("Stock insuficiente") ? "Stock insuficiente para realizar la salida." : error.message;
      toast({ title: "Error al registrar", description: msg, variant: "destructive" });
    } else {
      toast({ title: `${form.tipo === "entrada" ? "Entrada" : "Salida"} registrada correctamente` });
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
                  <TableHead>Observaciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{m.fecha}</TableCell>
                    <TableCell className="font-medium">{m.products?.nombre ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={m.tipo === "entrada"
                        ? "bg-primary/10 text-primary border-0"
                        : "bg-destructive/10 text-destructive border-0"
                      }>
                        {m.tipo === "entrada" ? "↑ Entrada" : "↓ Salida"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {m.tipo === "entrada" ? "+" : "-"}{Number(m.cantidad).toLocaleString("es-AR")} {m.products?.unidad}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.observaciones || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New movement dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Movimiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Producto *</Label>
              <Select value={form.product_id} onValueChange={v => setForm(f => ({ ...f, product_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccioná un producto" /></SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre} <span className="text-muted-foreground">({Number(p.stock_actual).toLocaleString("es-AR")} {p.unidad})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as "entrada" | "salida" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">↑ Entrada</SelectItem>
                    <SelectItem value="salida">↓ Salida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cantidad</Label>
                <Input type="number" min={1} value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: Number(e.target.value) }))} />
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
            <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voice dialog */}
      {showVoice && (
        <VoiceCard products={products} onConfirm={handleVoiceConfirm} onClose={() => setShowVoice(false)} />
      )}
    </div>
  );
}
