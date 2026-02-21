import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type Movement = {
  id: string; tipo: string; cantidad: number; fecha: string;
  products: { nombre: string; unidad: string } | null;
};

export default function DailySummary() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [movements, setMovements] = useState<Movement[]>([]);
  const [chartData, setChartData] = useState<{ day: string; Entradas: number; Salidas: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDay() {
      setLoading(true);
      const { data } = await supabase
        .from("movements")
        .select("id, tipo, cantidad, fecha, products(nombre, unidad)")
        .eq("fecha", date)
        .order("created_at", { ascending: false });
      setMovements((data as Movement[]) || []);
      setLoading(false);
    }
    fetchDay();
  }, [date]);

  useEffect(() => {
    async function fetchChart() {
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(new Date(), 6 - i);
        return format(d, "yyyy-MM-dd");
      });
      const { data } = await supabase
        .from("movements")
        .select("tipo, cantidad, fecha")
        .in("fecha", days);

      const result = days.map(d => {
        const dayMov = (data || []).filter(m => m.fecha === d);
        return {
          day: format(new Date(d + "T00:00:00"), "dd/MM"),
          Entradas: dayMov.filter(m => m.tipo === "entrada").reduce((s, m) => s + Number(m.cantidad), 0),
          Salidas: dayMov.filter(m => m.tipo === "salida").reduce((s, m) => s + Number(m.cantidad), 0),
        };
      });
      setChartData(result);
    }
    fetchChart();
  }, []);

  const entradas = movements.filter(m => m.tipo === "entrada").reduce((s, m) => s + Number(m.cantidad), 0);
  const salidas = movements.filter(m => m.tipo === "salida").reduce((s, m) => s + Number(m.cantidad), 0);
  const balance = entradas - salidas;

  // Top 5 products by outgoing
  const topSalidas = Object.entries(
    movements.filter(m => m.tipo === "salida").reduce((acc, m) => {
      const name = m.products?.nombre ?? "?";
      acc[name] = (acc[name] || 0) + Number(m.cantidad);
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold">Resumen Diario</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(date + "T00:00:00"), "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <Input type="date" className="w-48" value={date} onChange={e => setDate(e.target.value)} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Entradas</p>
            </div>
            <p className="text-2xl font-bold text-primary">{entradas.toLocaleString("es-AR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-destructive" />
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Salidas</p>
            </div>
            <p className="text-2xl font-bold text-destructive">{salidas.toLocaleString("es-AR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Minus className="w-4 h-4 text-foreground" />
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Balance Neto</p>
            </div>
            <p className={`text-2xl font-bold ${balance >= 0 ? "text-primary" : "text-destructive"}`}>
              {balance >= 0 ? "+" : ""}{balance.toLocaleString("es-AR")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* 7-day chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos 7 días</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Entradas" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Salidas" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top 5 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 salidas del día</CardTitle>
          </CardHeader>
          <CardContent>
            {topSalidas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin salidas registradas este día</p>
            ) : (
              <div className="space-y-2">
                {topSalidas.map(([nombre, qty], i) => (
                  <div key={nombre} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                      <span className="text-sm font-medium truncate">{nombre}</span>
                    </div>
                    <Badge variant="secondary" className="shrink-0 font-mono">{qty.toLocaleString("es-AR")}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Movement list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalle de movimientos ({movements.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Cargando...</div>
          ) : movements.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">No hay movimientos en esta fecha.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.products?.nombre ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={m.tipo === "entrada"
                        ? "bg-primary/10 text-primary border-0"
                        : m.tipo === "salida"
                        ? "bg-destructive/10 text-destructive border-0"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0"
                      }>
                        {m.tipo === "entrada" ? "↑ Entrada" : m.tipo === "salida" ? "↓ Salida" : "⟳ Ajuste"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {m.tipo === "entrada" ? "+" : m.tipo === "salida" ? "-" : "="}{Number(m.cantidad).toLocaleString("es-AR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
