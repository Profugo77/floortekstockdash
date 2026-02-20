import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Search, Download, Boxes } from "lucide-react";

type Product = {
  id: string; nombre: string; categoria: string; unidad: string;
  stock_actual: number; stock_minimo: number | null; stock_minimo_activo: boolean;
};

type CategorySummary = { categoria: string; total: number; count: number; lowCount: number };

export default function Stock() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    supabase.from("products").select("*").order("nombre").then(({ data }) => {
      setProducts(data || []);
      setLoading(false);
    });
  }, []);

  const categorias = [...new Set(products.map(p => p.categoria))].sort();

  const filtered = products.filter(p => {
    const matchSearch = p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.categoria.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategoria === "all" || p.categoria === filterCategoria;
    const isLow = p.stock_minimo_activo && p.stock_minimo !== null && p.stock_actual <= p.stock_minimo;
    const matchStatus =
      filterStatus === "all" ? true :
      filterStatus === "low" ? isLow :
      filterStatus === "ok" ? (!isLow && p.stock_minimo_activo) :
      filterStatus === "noalert" ? !p.stock_minimo_activo : true;
    return matchSearch && matchCat && matchStatus;
  });

  // Totals by category
  const categorySummaries: CategorySummary[] = categorias.map(cat => {
    const catProducts = products.filter(p => p.categoria === cat);
    return {
      categoria: cat,
      total: catProducts.reduce((s, p) => s + Number(p.stock_actual), 0),
      count: catProducts.length,
      lowCount: catProducts.filter(p => p.stock_minimo_activo && p.stock_minimo !== null && p.stock_actual <= p.stock_minimo).length,
    };
  });

  const grandTotal = products.reduce((s, p) => s + Number(p.stock_actual), 0);
  const lowCount = products.filter(p => p.stock_minimo_activo && p.stock_minimo !== null && p.stock_actual <= p.stock_minimo).length;

  const handleExportCSV = () => {
    const header = "nombre,categoria,unidad,stock_actual,stock_minimo,alerta_activa";
    const rows = filtered.map(p =>
      [p.nombre, p.categoria, p.unidad, p.stock_actual, p.stock_minimo ?? "", p.stock_minimo_activo ? "sí" : "no"].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `stock-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Stock Consolidado</h1>
          <p className="text-sm text-muted-foreground">{products.length} productos · {grandTotal.toLocaleString("es-AR")} unidades totales</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="w-4 h-4 mr-1" /> Exportar CSV
        </Button>
      </div>

      {/* Category summary cards */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          <Card className="col-span-2 sm:col-span-1 border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total general</p>
              <p className="text-2xl font-bold text-primary mt-1">{grandTotal.toLocaleString("es-AR")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{products.length} productos</p>
            </CardContent>
          </Card>
          {categorySummaries.map(s => (
            <Card
              key={s.categoria}
              className={`cursor-pointer transition-colors ${filterCategoria === s.categoria ? "border-primary ring-1 ring-primary" : ""} ${s.lowCount > 0 ? "border-destructive/30" : ""}`}
              onClick={() => setFilterCategoria(prev => prev === s.categoria ? "all" : s.categoria)}
            >
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium truncate">{s.categoria}</p>
                <p className="text-xl font-bold mt-1">{s.total.toLocaleString("es-AR")}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <p className="text-xs text-muted-foreground">{s.count} productos</p>
                  {s.lowCount > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">{s.lowCount} bajo</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar producto o categoría..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="low">Bajo mínimo</SelectItem>
            <SelectItem value="ok">OK</SelectItem>
            <SelectItem value="noalert">Sin alerta</SelectItem>
          </SelectContent>
        </Select>
        {(search || filterCategoria !== "all" || filterStatus !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFilterCategoria("all"); setFilterStatus("all"); }}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Cargando stock...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No hay productos que coincidan.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="text-right">Stock Actual</TableHead>
                  <TableHead className="text-right">Stock Mínimo</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => {
                  const isLow = p.stock_minimo_activo && p.stock_minimo !== null && p.stock_actual <= p.stock_minimo;
                  return (
                    <TableRow key={p.id} className={isLow ? "bg-destructive/5" : ""}>
                      <TableCell className="font-medium">{p.nombre}</TableCell>
                      <TableCell><Badge variant="secondary">{p.categoria}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{p.unidad}</TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${isLow ? "text-destructive" : ""}`}>
                        {Number(p.stock_actual).toLocaleString("es-AR")}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {p.stock_minimo !== null ? Number(p.stock_minimo).toLocaleString("es-AR") : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {!p.stock_minimo_activo ? (
                          <Badge className="text-xs bg-muted text-muted-foreground border-0">Sin alerta</Badge>
                        ) : isLow ? (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertTriangle className="w-3 h-3" /> Bajo mínimo
                          </Badge>
                        ) : (
                          <Badge className="text-xs bg-primary/10 text-primary border-0">OK</Badge>
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
    </div>
  );
}
