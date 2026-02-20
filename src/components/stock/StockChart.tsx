import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

type ChartRow = { categoria: string; stock: number; minimo: number; porcentaje: number };

interface Props {
  data: ChartRow[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-primary">Stock: <span className="font-bold tabular-nums">{payload[0]?.value?.toLocaleString("es-AR")}</span></p>
      {payload[1]?.value > 0 && (
        <p className="text-destructive">Mínimo: <span className="font-bold tabular-nums">{payload[1]?.value?.toLocaleString("es-AR")}</span></p>
      )}
    </div>
  );
};

export default function StockChart({ data }: Props) {
  if (!data.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Stock por categoría
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} barCategoryGap="30%" barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="categoria"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted)/0.5)" }} />
            <Bar dataKey="stock" name="Stock" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.categoria}
                  fill={entry.minimo > 0 && entry.stock <= entry.minimo
                    ? "hsl(var(--destructive))"
                    : "hsl(var(--primary))"}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
            <Bar dataKey="minimo" name="Mínimo" radius={[4, 4, 0, 0]} fill="hsl(var(--muted-foreground))" fillOpacity={0.3} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary/80" /> Stock actual
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-muted-foreground/30" /> Stock mínimo
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-destructive/80" /> Bajo mínimo
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
