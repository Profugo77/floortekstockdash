import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { subDays, format } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Trophy, PackageX, TrendingUp } from "lucide-react";

type RankItem = { nombre: string; total: number };

export default function Analysis() {
  const [rank30, setRank30] = useState<RankItem[]>([]);
  const [rank90, setRank90] = useState<RankItem[]>([]);
  const [noMovement, setNoMovement] = useState<string[]>([]);
  const [trend, setTrend] = useState<{ month: string; [key: string]: number | string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalysis() {
      const today = new Date();
      const date30 = format(subDays(today, 30), "yyyy-MM-dd");
      const date90 = format(subDays(today, 90), "yyyy-MM-dd");

      const [res30, res90, productsRes, trendRes] = await Promise.all([
        supabase.from("movements").select("cantidad, products(nombre)").eq("tipo", "salida").gte("fecha", date30),
        supabase.from("movements").select("cantidad, products(nombre)").eq("tipo", "salida").gte("fecha", date90),
        supabase.from("products").select("nombre"),
        supabase.from("movements").select("cantidad, tipo, fecha, products(nombre)").gte("fecha", date90),
      ]);

      const buildRank = (data: { cantidad: number; products: { nombre: string } | null }[]) => {
        const map: Record<string, number> = {};
        data.forEach(m => {
          const n = m.products?.nombre ?? "?";
          map[n] = (map[n] || 0) + Number(m.cantidad);
        });
        return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([nombre, total]) => ({ nombre, total }));
      };

      setRank30(buildRank((res30.data || []) as { cantidad: number; products: { nombre: string } | null }[]));
      setRank90(buildRank((res90.data || []) as { cantidad: number; products: { nombre: string } | null }[]));

      const activeProducts = new Set((res90.data || []).map((m: { products: { nombre: string } | null }) => m.products?.nombre));
      const allProducts = (productsRes.data || []).map(p => p.nombre);
      setNoMovement(allProducts.filter(n => !activeProducts.has(n)));

      // Monthly trend — last 3 months, top 5 products by 90d sales
      const top5 = buildRank((res90.data || []) as { cantidad: number; products: { nombre: string } | null }[]).slice(0, 5).map(r => r.nombre);
      const months = Array.from({ length: 3 }, (_, i) => {
        const d = subDays(today, (2 - i) * 30);
        return format(d, "MMM yy");
      });

      const trendData = months.map((month, i) => {
        const start = format(subDays(today, (2 - i) * 30 + 30), "yyyy-MM-dd");
        const end = format(subDays(today, (2 - i) * 30), "yyyy-MM-dd");
        const entry: { month: string; [key: string]: number | string } = { month };
        top5.forEach(name => {
          entry[name] = ((trendRes.data || []) as { cantidad: number; tipo: string; fecha: string; products: { nombre: string } | null }[])
            .filter(m => m.products?.nombre === name && m.tipo === "salida" && m.fecha >= start && m.fecha < end)
            .reduce((s, m) => s + Number(m.cantidad), 0);
        });
        return entry;
      });

      setTrend(trendData);
      setLoading(false);
    }
    fetchAnalysis();
  }, []);

  const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "#f59e0b", "#6366f1", "#ec4899"];

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando análisis...</div>;

  const top5Names = rank90.slice(0, 5).map(r => r.nombre);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Análisis de Rotación</h1>
        <p className="text-sm text-muted-foreground">Productos con mayor movimiento de salida</p>
      </div>

      {rank90[0] && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
          <Trophy className="w-8 h-8 text-primary shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Mayor rotación 90 días</p>
            <p className="text-lg font-bold text-primary">{rank90[0].nombre}</p>
            <p className="text-sm text-muted-foreground">{rank90[0].total.toLocaleString("es-AR")} unidades en salidas</p>
          </div>
        </div>
      )}

      <Tabs defaultValue="30d">
        <TabsList>
          <TabsTrigger value="30d">Últimos 30 días</TabsTrigger>
          <TabsTrigger value="90d">Últimos 90 días</TabsTrigger>
          <TabsTrigger value="noMovement">Sin movimiento</TabsTrigger>
        </TabsList>

        <TabsContent value="30d" className="mt-4">
          <RankingTable data={rank30} label="30 días" />
        </TabsContent>
        <TabsContent value="90d" className="mt-4">
          <RankingTable data={rank90} label="90 días" />
        </TabsContent>
        <TabsContent value="noMovement" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PackageX className="w-4 h-4 text-muted-foreground" />
                Productos sin movimiento (últimos 90 días)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {noMovement.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Todos los productos tuvieron movimiento</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {noMovement.map(n => <Badge key={n} variant="secondary" className="text-sm">{n}</Badge>)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Trend chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Tendencia mensual — Top 5 productos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {top5Names.map((name, i) => (
                <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function RankingTable({ data, label }: { data: { nombre: string; total: number }[]; label: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ranking de salidas — {label}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {data.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">Sin datos en este período</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Total Salidas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, i) => (
                <TableRow key={item.nombre}>
                  <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{item.nombre}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {item.total.toLocaleString("es-AR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
