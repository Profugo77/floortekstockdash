import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, RefreshCw, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { generateStockReportPdf } from "@/lib/stockReportPdf";

import StockCategoryCards, { CategorySummary } from "@/components/stock/StockCategoryCards";
import StockChart from "@/components/stock/StockChart";
import StockTable, { Product, SortKey, SortDir } from "@/components/stock/StockTable";

export default function Stock() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("nombre");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [pulse, setPulse] = useState(false);

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("*").order("nombre");
    setProducts(data || []);
    setLoading(false);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    fetchProducts();

    // Realtime subscription
    const channel = supabase
      .channel("stock-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        setPulse(true);
        fetchProducts();
        setTimeout(() => setPulse(false), 1200);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Sort handler
  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const categorias = useMemo(() => [...new Set(products.map(p => p.categoria))].sort(), [products]);

  const filtered = useMemo(() => {
    const result = products.filter(p => {
      const matchSearch =
        p.nombre.toLowerCase().includes(search.toLowerCase()) ||
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

    return result.sort((a, b) => {
      let va: any = a[sortKey] ?? "";
      let vb: any = b[sortKey] ?? "";
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      return sortDir === "asc" ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
    });
  }, [products, search, filterCategoria, filterStatus, sortKey, sortDir]);

  // Category summaries
  const categorySummaries: CategorySummary[] = useMemo(() =>
    categorias.map(cat => {
      const catProducts = products.filter(p => p.categoria === cat);
      return {
        categoria: cat,
        total: catProducts.reduce((s, p) => s + Number(p.stock_actual), 0),
        count: catProducts.length,
        lowCount: catProducts.filter(
          p => p.stock_minimo_activo && p.stock_minimo !== null && p.stock_actual <= p.stock_minimo
        ).length,
      };
    }),
  [products, categorias]);

  // Chart data (one row per category)
  const chartData = useMemo(() =>
    categorySummaries.map(s => {
      const catProds = products.filter(p => p.categoria === s.categoria && p.stock_minimo_activo && p.stock_minimo !== null);
      const totalMin = catProds.reduce((acc, p) => acc + Number(p.stock_minimo), 0);
      return { categoria: s.categoria, stock: s.total, minimo: totalMin, porcentaje: totalMin > 0 ? (s.total / totalMin) * 100 : 100 };
    }),
  [categorySummaries, products]);

  const grandTotal = useMemo(() => products.reduce((s, p) => s + Number(p.stock_actual), 0), [products]);

  const handleExportCSV = () => {
    const header = "nombre,categoria,unidad,stock_actual,stock_minimo,alerta_activa";
    const rows = filtered.map(p =>
      [p.nombre, p.categoria, p.unidad, p.stock_actual, p.stock_minimo ?? "", p.stock_minimo_activo ? "sí" : "no"].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `stock-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const hasFilters = search || filterCategoria !== "all" || filterStatus !== "all";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Stock Consolidado</h1>
            {pulse && (
              <span className="inline-flex items-center gap-1 text-[10px] text-primary font-medium animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                Actualizando
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {products.length} productos · {grandTotal.toLocaleString("es-AR")} unidades ·{" "}
            <span className="text-[11px]">
              Actualizado {lastUpdated.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchProducts}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-3.5 h-3.5 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {/* Category cards */}
      {!loading && (
        <StockCategoryCards
          summaries={categorySummaries}
          grandTotal={grandTotal}
          totalProducts={products.length}
          filterCategoria={filterCategoria}
          onSelectCategoria={(cat) => setFilterCategoria(prev => prev === cat ? "all" : cat)}
        />
      )}

      {/* Chart */}
      {!loading && chartData.length > 0 && <StockChart data={chartData} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
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
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="low">Bajo mínimo</SelectItem>
            <SelectItem value="ok">OK</SelectItem>
            <SelectItem value="noalert">Sin alerta</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="text-muted-foreground"
            onClick={() => { setSearch(""); setFilterCategoria("all"); setFilterStatus("all"); }}>
            Limpiar
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} de {products.length} productos
        </span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <StockTable
            products={filtered}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            loading={loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
