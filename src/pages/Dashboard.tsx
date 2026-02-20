import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, TrendingDown, TrendingUp, AlertTriangle, ArrowLeftRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Stats {
  totalProducts: number;
  totalStock: number;
  belowMinimum: { id: string; nombre: string; stock_actual: number; stock_minimo: number | null }[];
  todayMovements: number;
  todayEntradas: number;
  todaySalidas: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalProducts: 0, totalStock: 0, belowMinimum: [], todayMovements: 0, todayEntradas: 0, todaySalidas: 0,
  });
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    async function fetchStats() {
      const [productsRes, movementsRes] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("movements").select("*").eq("fecha", today),
      ]);

      const products = productsRes.data || [];
      const movements = movementsRes.data || [];

      const below = products.filter(
        p => p.stock_minimo_activo && p.stock_minimo !== null && p.stock_actual <= p.stock_minimo
      );

      const entradas = movements.filter(m => m.tipo === "entrada").reduce((s, m) => s + Number(m.cantidad), 0);
      const salidas = movements.filter(m => m.tipo === "salida").reduce((s, m) => s + Number(m.cantidad), 0);

      setStats({
        totalProducts: products.length,
        totalStock: products.reduce((s, p) => s + Number(p.stock_actual), 0),
        belowMinimum: below,
        todayMovements: movements.length,
        todayEntradas: entradas,
        todaySalidas: salidas,
      });
      setLoading(false);
    }
    fetchStats();
  }, [today]);

  const chartData = [
    { name: "Hoy", Entradas: stats.todayEntradas, Salidas: stats.todaySalidas },
  ];

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Productos"
          value={stats.totalProducts}
          icon={<Package className="w-5 h-5" />}
          color="text-primary"
        />
        <StatCard
          title="Stock Total"
          value={stats.totalStock.toLocaleString("es-AR")}
          icon={<Package className="w-5 h-5" />}
          color="text-foreground"
        />
        <StatCard
          title="Bajo Mínimo"
          value={stats.belowMinimum.length}
          icon={<AlertTriangle className="w-5 h-5" />}
          color={stats.belowMinimum.length > 0 ? "text-destructive" : "text-muted-foreground"}
          alert={stats.belowMinimum.length > 0}
        />
        <StatCard
          title="Movimientos Hoy"
          value={stats.todayMovements}
          icon={<ArrowLeftRight className="w-5 h-5" />}
          color="text-foreground"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entradas vs Salidas — Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barCategoryGap="40%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Entradas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Salidas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Below minimum */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Productos bajo stock mínimo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.belowMinimum.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                ✓ Todos los productos están sobre el mínimo
              </p>
            ) : (
              <div className="space-y-2">
                {stats.belowMinimum.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
                    <span className="text-sm font-medium truncate">{p.nombre}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="destructive" className="text-xs">
                        {p.stock_actual} / {p.stock_minimo}
                      </Badge>
                    </div>
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

function StatCard({ title, value, icon, color, alert }: {
  title: string; value: string | number; icon: React.ReactNode; color: string; alert?: boolean;
}) {
  return (
    <Card className={alert ? "border-destructive/30" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
          <div className={`mt-0.5 ${color}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-muted rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><div className="h-16 bg-muted rounded animate-pulse" /></CardContent></Card>
        ))}
      </div>
    </div>
  );
}
