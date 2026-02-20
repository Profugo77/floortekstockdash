import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown } from "lucide-react";

export type CategorySummary = {
  categoria: string;
  total: number;
  count: number;
  lowCount: number;
};

interface Props {
  summaries: CategorySummary[];
  grandTotal: number;
  totalProducts: number;
  filterCategoria: string;
  onSelectCategoria: (cat: string) => void;
}

export default function StockCategoryCards({
  summaries, grandTotal, totalProducts, filterCategoria, onSelectCategoria,
}: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      {/* Grand total card */}
      <Card className="col-span-2 sm:col-span-1 border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Total general</p>
          <p className="text-3xl font-bold text-primary mt-1 tabular-nums">
            {grandTotal.toLocaleString("es-AR")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{totalProducts} productos</p>
        </CardContent>
      </Card>

      {summaries.map((s) => {
        const isSelected = filterCategoria === s.categoria;
        const hasAlert = s.lowCount > 0;
        return (
          <Card
            key={s.categoria}
            onClick={() => onSelectCategoria(s.categoria)}
            className={[
              "cursor-pointer transition-all duration-150 select-none",
              isSelected
                ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                : "hover:border-border/80 hover:shadow-sm",
              hasAlert && !isSelected ? "border-destructive/30" : "",
            ].join(" ")}
          >
            <CardContent className="p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold truncate">
                {s.categoria}
              </p>
              <p className="text-2xl font-bold mt-1 tabular-nums">{s.total.toLocaleString("es-AR")}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground">{s.count} prod.</span>
                {hasAlert && (
                  <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 gap-0.5">
                    <TrendingDown className="w-2.5 h-2.5" />
                    {s.lowCount}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
