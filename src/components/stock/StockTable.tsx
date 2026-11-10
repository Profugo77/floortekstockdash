import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type Product = {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
  stock_actual: number;
  stock_minimo: number | null;
  stock_minimo_activo: boolean;
};

export type SortKey = "nombre" | "categoria" | "stock_actual" | "stock_minimo";
export type SortDir = "asc" | "desc";

interface Props {
  products: Product[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  loading: boolean;
}

function StockBar({ actual, minimo, activo }: { actual: number; minimo: number | null; activo: boolean }) {
  if (!activo || minimo === null || minimo <= 0) return null;
  const pct = Math.min((actual / minimo) * 100, 100);
  const isLow = actual <= minimo;
  return (
    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
      <div
        className={cn("h-1.5 rounded-full transition-all", isLow ? "bg-destructive" : "bg-primary")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown className="w-3 h-3 opacity-30 inline ml-1" />;
  return sortDir === "asc"
    ? <ArrowUp className="w-3 h-3 opacity-70 inline ml-1" />
    : <ArrowDown className="w-3 h-3 opacity-70 inline ml-1" />;
}

function Th({ label, col, sortKey, sortDir, onSort, className }: {
  label: string; col: SortKey; sortKey: SortKey; sortDir: SortDir;
  onSort: (k: SortKey) => void; className?: string;
}) {
  return (
    <TableHead
      className={cn("cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap", className)}
      onClick={() => onSort(col)}
    >
      {label}
      <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
    </TableHead>
  );
}

export default function StockTable({ products, sortKey, sortDir, onSort, loading }: Props) {
  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-10 bg-muted animate-pulse rounded-md" style={{ opacity: 1 - i * 0.12 }} />
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="py-16 text-center">
        <p className="text-2xl mb-1">📦</p>
        <p className="text-sm text-muted-foreground">No hay productos que coincidan con los filtros.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <Th label="Producto" col="nombre" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
          <Th label="Categoría" col="categoria" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
          <TableHead>Unidad</TableHead>
          <Th label="Stock Actual" col="stock_actual" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="text-right" />
          <Th label="Stock Mínimo" col="stock_minimo" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="text-right" />
          <TableHead className="text-center w-32">Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((p) => {
          const isLow = p.stock_minimo_activo && p.stock_minimo !== null && p.stock_actual <= p.stock_minimo;
          return (
            <TableRow key={p.id} className={isLow ? "bg-destructive/5 hover:bg-destructive/10" : ""}>
              <TableCell className="font-medium max-w-[200px]">
                <span className="block truncate" title={p.nombre}>{p.nombre}</span>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-xs font-normal">{p.categoria}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">{p.unidad}</TableCell>
              <TableCell className="text-right">
                <span className={cn("font-mono font-semibold tabular-nums", isLow ? "text-destructive" : "")}>
                  {Number(p.stock_actual).toLocaleString("es-AR")}
                </span>
                <StockBar actual={Number(p.stock_actual)} minimo={p.stock_minimo} activo={p.stock_minimo_activo} />
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-muted-foreground text-sm">
                {p.stock_minimo !== null ? Number(p.stock_minimo).toLocaleString("es-AR") : "—"}
              </TableCell>
              <TableCell className="text-center">
                {!p.stock_minimo_activo ? (
                  <Badge className="text-[10px] bg-muted text-muted-foreground border-0 font-normal">Sin alerta</Badge>
                ) : isLow ? (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" /> Bajo mínimo
                  </Badge>
                ) : (
                  <Badge className="text-[10px] bg-primary/10 text-primary border-0 font-normal">OK</Badge>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
