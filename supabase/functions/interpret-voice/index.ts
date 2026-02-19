import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, productNames } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Eres un asistente de control de stock para una empresa de pisos y revestimientos.
Tu única tarea es interpretar frases de voz para registrar movimientos de stock.

Dado el texto del usuario, extrae:
- tipo: "entrada" o "salida"
- cantidad: número entero positivo
- producto_nombre: el nombre del producto mencionado
- confianza: "alta" si la frase es clara, "media" si hay algo ambiguo, "baja" si no estás seguro

Compara el producto mencionado con la lista de productos disponibles y devuelve el nombre más similar.

Lista de productos disponibles:
${productNames}

Responde SOLO con un JSON válido con esta estructura exacta:
{
  "tipo": "entrada" | "salida",
  "cantidad": number,
  "producto_nombre": string,
  "matched_product_name": string | null,
  "confianza": "alta" | "media" | "baja",
  "error": null | string
}

Si no puedes determinar algún campo esencial (tipo, cantidad o producto), incluye un error descriptivo.
No incluyas texto adicional, solo el JSON.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido, intenta en unos momentos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes en el plan de IA." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content ?? "";

    // Parse JSON from the response
    let parsed: Record<string, unknown>;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: "No se pudo interpretar la respuesta" };
    } catch {
      parsed = { error: "Error al procesar la respuesta de la IA" };
    }

    // Match product name to ID using the product names list
    const productList = productNames.split(", ");
    let matched_product_id: string | null = null;

    if (parsed.matched_product_name && !parsed.error) {
      // We'll return the matched name and let the client find the ID
      // Since we don't have IDs here, we use the Supabase client in the edge function
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: product } = await supabase
        .from("products")
        .select("id, nombre")
        .ilike("nombre", `%${parsed.matched_product_name}%`)
        .limit(1)
        .single();

      if (product) {
        matched_product_id = product.id;
        parsed.producto_nombre = product.nombre;
      }
    }

    return new Response(JSON.stringify({ ...parsed, matched_product_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("interpret-voice error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
