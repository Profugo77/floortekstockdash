import { useEffect, useState, useCallback, useRef } from "react";
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
import { Plus, Mic, Search, X, TrendingUp, TrendingDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import VoiceCard from "@/components/VoiceCard";

type Product = { id: string; nombre: string; stock_actual: number; unidad: string };
type Movement = {
  id: string; tipo: string; cantidad: number; fecha: string;
  observaciones: string | null; created_at: string; user_id: string;
  products: { nombre: string; unidad: string } | null;
};
type ProfileMap = Record<string, { full_name: string | null; email: string }>;

const emptyForm = { product_id: "", tipo: "entrada" as "entrada" | "salida", cantidad: 1, fecha: format(new Date(), "yyyy-MM-dd"), observaciones: "" };

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

  // Sync display when value changes externally (e.g. form reset)
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
  const [profileMap, setProfileMap] = useState<ProfileMap>({});

  const fetchData = useCallback(async () => {
    const [productsRes, movementsRes, profilesRes] = await Promise.all([
      supabase.from("products").select("id, nombre, stock_actual, unidad").order("nombre"),
      supabase.from("movements").select("id, tipo, cantidad, fecha, observaciones, created_at, user_id, products(nombre, unidad)").order("created_at", { ascending: false }).limit(200),
      supabase.from("profiles").select("id, full_name, email"),
    ]);
    setProducts(productsRes.data || []);
    setMovements((movementsRes.data as Movement[]) || []);
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
                  <TableHead>Usuario</TableHead>
                  <TableHead>Observaciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(m => {
                  const profile = profileMap[m.user_id];
                  const userName = profile?.full_name || profile?.email || "—";
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{m.fecha}</TableCell>
                      <TableCell className="font-medium">{m.products?.nombre ?? "—"}</TableCell>
                      <TableCell>
                        {m.tipo === "entrada" ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 gap-1">
                            <TrendingUp className="w-3 h-3" /> Entrada
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 gap-1">
                            <TrendingDown className="w-3 h-3" /> Salida
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${m.tipo === "entrada" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {m.tipo === "entrada" ? "+" : "-"}{Number(m.cantidad).toLocaleString("es-AR")} {m.products?.unidad}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{userName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.observaciones || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, tipo: "entrada" }))}
                    className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors
                      ${form.tipo === "entrada"
                        ? "bg-green-500 text-white border-green-500"
                        : "bg-background text-muted-foreground border-border hover:bg-green-50 hover:text-green-700 hover:border-green-300 dark:hover:bg-green-900/20"
                      }`}
                  >
                    <TrendingUp className="w-4 h-4" /> Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, tipo: "salida" }))}
                    className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors
                      ${form.tipo === "salida"
                        ? "bg-red-500 text-white border-red-500"
                        : "bg-background text-muted-foreground border-border hover:bg-red-50 hover:text-red-700 hover:border-red-300 dark:hover:bg-red-900/20"
                      }`}
                  >
                    <TrendingDown className="w-4 h-4" /> Salida
                  </button>
                </div>
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
            <Button
              onClick={handleSave}
              disabled={saving}
              className={form.tipo === "entrada" ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"}
            >
              {saving ? "Guardando..." : form.tipo === "entrada" ? "Registrar Entrada" : "Registrar Salida"}
            </Button>
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
