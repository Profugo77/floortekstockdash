import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Package, AlertTriangle, ArrowLeftRight, TrendingUp, TrendingDown,
  ChevronRight, Layers, BarChart3,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from "recharts";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";

interface Stats {
  totalProducts: number;
  totalStock: number;
  belowMinimum: { id: string; nombre: string; stock_actual: number; stock_minimo: number | null; categoria: string }[];
  todayMovements: number;
  todayEntradas: number;
  todaySalidas: number;
  categorias: { categoria: string; total: number; count: number; lowCount: number }[];
  weekChart: { day: string; Entradas: number; Salidas: number }[];
  topMovidos: { nombre: string; cantidad: number }[];
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalProducts: 0, totalStock: 0, belowMinimum: [], todayMovements: 0,
    todayEntradas: 0, todaySalidas: 0, categorias: [], weekChart: [], topMovidos: [],
  });
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    async function fetchStats() {
      const weekAgo = format(subDays(new Date(), 6), "yyyy-MM-dd");

      const [productsRes, todayMovRes, weekMovRes] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("movements").select("*, products(nombre, unidad)").eq("fecha", today),
        supabase.from("movements").select("*, products(nombre)").gte("fecha", weekAgo).order("fecha"),
      ]);

      const products = productsRes.data || [];
      const todayMov = todayMovRes.data || [];
      const weekMov = weekMovRes.data || [];

      const below = products.filter(
        p => p.stock_minimo_activo && p.stock_minimo !== null && p.stock_actual <= p.stock_minimo
      );

      const entradas = todayMov.filter(m => m.tipo === "entrada").reduce((s, m) => s + Number(m.cantidad), 0);
      const salidas = todayMov.filter(m => m.tipo === "salida").reduce((s, m) => s + Number(m.cantidad), 0);

      // Category summaries
      const catMap = new Map<string, { total: number; count: number; lowCount: number }>();
      products.forEach(p => {
        const existing = catMap.get(p.categoria) || { total: 0, count: 0, lowCount: 0 };
        existing.total += Number(p.stock_actual);
        existing.count += 1;
        if (p.stock_minimo_activo && p.stock_minimo !== null && p.stock_actual <= p.stock_minimo) {
          existing.lowCount += 1;
        }
        catMap.set(p.categoria, existing);
      });
      const categorias = Array.from(catMap.entries())
        .map(([categoria, data]) => ({ categoria, ...data }))
        .sort((a, b) => b.total - a.total);

      // Week chart
      const dayMap = new Map<string, { Entradas: number; Salidas: number }>();
      for (let i = 6; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "yyyy-MM-dd");
        dayMap.set(d, { Entradas: 0, Salidas: 0 });
      }
      weekMov.forEach(m => {
        const day = dayMap.get(m.fecha);
        if (day) {
          if (m.tipo === "entrada") day.Entradas += Number(m.cantidad);
          else if (m.tipo === "salida") day.Salidas += Number(m.cantidad);
        }
      });
      const weekChart = Array.from(dayMap.entries()).map(([date, vals]) => ({
        day: format(new Date(date + "T12:00:00"), "EEE", { locale: es }),
        ...vals,
      }));

      // Top movidos (most moved products this week)
      const prodMovMap = new Map<string, number>();
      weekMov.forEach(m => {
        const name = (m.products as any)?.nombre || "—";
        prodMovMap.set(name, (prodMovMap.get(name) || 0) + Number(m.cantidad));
      });
      const topMovidos = Array.from(prodMovMap.entries())
        .map(([nombre, cantidad]) => ({ nombre, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5);

      setStats({
        totalProducts: products.length,
        totalStock: products.reduce((s, p) => s + Number(p.stock_actual), 0),
        belowMinimum: below,
        todayMovements: todayMov.length,
        todayEntradas: entradas,
        todaySalidas: salidas,
        categorias,
        weekChart,
        topMovidos,
      });
      setLoading(false);
    }
    fetchStats();
  }, [today]);

  if (loading) return <DashboardSkeleton />;

  const stockHealth = stats.totalProducts > 0
    ? Math.round(((stats.totalProducts - stats.belowMinimum.length) / stats.totalProducts) * 100)
    : 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Productos"
          value={stats.totalProducts}
          subtitle={`${stats.categorias.length} categorías`}
          icon={<Package className="w-5 h-5" />}
          onClick={() => navigate("/productos")}
          color="primary"
        />
        <KpiCard
          title="Stock Total"
          value={stats.totalStock.toLocaleString("es-AR")}
          subtitle="unidades en inventario"
          icon={<Layers className="w-5 h-5" />}
          onClick={() => navigate("/stock")}
          color="primary"
        />
        <KpiCard
          title="Bajo Mínimo"
          value={stats.belowMinimum.length}
          subtitle={stats.belowMinimum.length > 0 ? "requieren atención" : "todo en orden ✓"}
          icon={<AlertTriangle className="w-5 h-5" />}
          onClick={() => navigate("/stock")}
          color={stats.belowMinimum.length > 0 ? "destructive" : "muted"}
          alert={stats.belowMinimum.length > 0}
        />
        <KpiCard
          title="Movimientos Hoy"
          value={stats.todayMovements}
          subtitle={`↑${stats.todayEntradas}  ↓${stats.todaySalidas}`}
          icon={<ArrowLeftRight className="w-5 h-5" />}
          onClick={() => navigate("/movimientos")}
          color="primary"
        />
      </div>

      {/* Stock Health Bar */}
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Salud del inventario</span>
            <span className={`text-sm font-bold ${stockHealth >= 80 ? "text-primary" : stockHealth >= 50 ? "text-amber-500" : "text-destructive"}`}>
              {stockHealth}%
            </span>
          </div>
          <Progress value={stockHealth} className="h-2.5" />
          <p className="text-xs text-muted-foreground mt-1.5">
            {stats.totalProducts - stats.belowMinimum.length} de {stats.totalProducts} productos sobre el mínimo
          </p>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Week chart */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/resumen")}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Últimos 7 días
              </CardTitle>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.weekChart} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Entradas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Salidas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Below minimum */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/stock")}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                Productos bajo mínimo
              </CardTitle>
              <div className="flex items-center gap-1.5">
                <Badge variant={stats.belowMinimum.length > 0 ? "destructive" : "secondary"} className="text-xs">
                  {stats.belowMinimum.length}
                </Badge>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {stats.belowMinimum.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Package className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Todos los productos están sobre el mínimo
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {stats.belowMinimum.slice(0, 8).map(p => {
                  const pct = p.stock_minimo ? Math.round((p.stock_actual / p.stock_minimo) * 100) : 0;
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-destructive/5 border border-destructive/15">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.nombre}</p>
                        <p className="text-[10px] text-muted-foreground">{p.categoria}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          {p.stock_actual} / {p.stock_minimo}
                        </Badge>
                        <div className="w-16 h-1 bg-destructive/15 rounded-full mt-1">
                          <div
                            className="h-full bg-destructive rounded-full"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {stats.belowMinimum.length > 8 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{stats.belowMinimum.length - 8} más
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top categories */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/stock")}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Top categorías</CardTitle>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.categorias.slice(0, 5).map((cat, i) => {
                const maxTotal = stats.categorias[0]?.total || 1;
                const pct = Math.round((cat.total / maxTotal) * 100);
                return (
                  <div key={cat.categoria} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate">{cat.categoria}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-muted-foreground text-xs">{cat.count} prod.</span>
                        <span className="font-semibold tabular-nums">{cat.total.toLocaleString("es-AR")}</span>
                        {cat.lowCount > 0 && (
                          <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                            <TrendingDown className="w-2.5 h-2.5 mr-0.5" />
                            {cat.lowCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full">
                      <div
                        className="h-full bg-primary/70 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top movidos */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/movimientos")}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Más movidos esta semana
              </CardTitle>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {stats.topMovidos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin movimientos esta semana</p>
            ) : (
              <div className="space-y-2.5">
                {stats.topMovidos.map((item, i) => (
                  <div key={item.nombre} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm truncate flex-1">{item.nombre}</span>
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {item.cantidad.toLocaleString("es-AR")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ title, value, subtitle, icon, color, alert, onClick }: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ReactNode; color: string; alert?: boolean;
  onClick?: () => void;
}) {
  const colorMap: Record<string, string> = {
    primary: "text-primary",
    destructive: "text-destructive",
    muted: "text-muted-foreground",
  };
  const textColor = colorMap[color] || "text-foreground";

  return (
    <Card
      onClick={onClick}
      className={`cursor-pointer hover:shadow-md transition-all group ${alert ? "border-destructive/30 bg-destructive/[0.02]" : "hover:border-primary/30"}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={`mt-0.5 ${textColor} opacity-70 group-hover:opacity-100 transition-opacity`}>
            {icon}
          </div>
        </div>
        <div className="flex items-center justify-end mt-1">
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-40 bg-muted rounded" />
        <div className="h-4 w-64 bg-muted rounded mt-2" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><div className="h-20 bg-muted rounded" /></CardContent></Card>
        ))}
      </div>
      <div className="h-3 w-full bg-muted rounded" />
      <div className="grid lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <Card key={i}><CardContent className="p-6"><div className="h-48 bg-muted rounded" /></CardContent></Card>
        ))}
      </div>
    </div>
  );
}
