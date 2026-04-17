import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ReportProduct = {
  nombre: string;
  referencia?: string | null;
  categoria: string;
  unidad: string;
  stock_actual: number;
};

export function generateStockReportPdf(products: ReportProduct[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const now = new Date();
  const fecha = now.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const hora = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

  // Header band
  doc.setFillColor(27, 127, 106); // primary
  doc.rect(0, 0, pageWidth, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("FloorTek Stock", 40, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Informe de stock", 40, 52);
  doc.setFontSize(10);
  doc.text(`${fecha} · ${hora}`, pageWidth - 40, 52, { align: "right" });

  // Summary
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const totalUnidades = products.reduce((s, p) => s + Number(p.stock_actual), 0);
  doc.text(
    `Productos seleccionados: ${products.length}  ·  Total unidades: ${totalUnidades.toLocaleString("es-AR")}`,
    40,
    92
  );

  // Table
  autoTable(doc, {
    startY: 110,
    head: [["#", "Producto", "Referencia", "Categoría", "Unidad", "Stock"]],
    body: products.map((p, i) => [
      String(i + 1),
      p.nombre,
      p.referencia || "—",
      p.categoria,
      p.unidad,
      Number(p.stock_actual).toLocaleString("es-AR"),
    ]),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 6, textColor: [40, 40, 40] },
    headStyles: { fillColor: [27, 127, 106], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 246] },
    columnStyles: {
      0: { cellWidth: 28, halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 40, right: 40 },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      const pageNumber = data.pageNumber;
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `FloorTek Stock · Informe generado el ${fecha} ${hora}`,
        40,
        pageHeight - 20
      );
      doc.text(`Página ${pageNumber} de ${pageCount}`, pageWidth - 40, pageHeight - 20, { align: "right" });
    },
  });

  const filename = `informe-stock-${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
