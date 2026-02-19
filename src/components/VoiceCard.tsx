import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Mic, MicOff, X, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Product = { id: string; nombre: string; stock_actual: number; unidad: string };

interface VoiceInterpretation {
  tipo: "entrada" | "salida";
  cantidad: number;
  producto_nombre: string;
  matched_product_id: string | null;
  confianza: "alta" | "media" | "baja";
  error?: string;
}

interface VoiceCardProps {
  products: Product[];
  onConfirm: (productId: string, tipo: "entrada" | "salida", cantidad: number) => void;
  onClose: () => void;
}

// SpeechRecognition type shim
interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  start(): void;
  stop(): void;
}
declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

export default function VoiceCard({ products, onConfirm, onClose }: VoiceCardProps) {
  const { toast } = useToast();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interpreting, setInterpreting] = useState(false);
  const [result, setResult] = useState<VoiceInterpretation | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [editTipo, setEditTipo] = useState<"entrada" | "salida">("salida");
  const [editCantidad, setEditCantidad] = useState<number>(1);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "es-AR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      interpretText(text);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      toast({ title: "Error al capturar voz", variant: "destructive" });
    };
    recognitionRef.current = recognition;
  }, []);

  const startListening = () => {
    if (!recognitionRef.current) {
      toast({ title: "Tu navegador no soporta reconocimiento de voz", variant: "destructive" });
      return;
    }
    setTranscript("");
    setResult(null);
    recognitionRef.current.start();
    setListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const interpretText = async (text: string) => {
    setInterpreting(true);
    try {
      const productNames = products.map(p => p.nombre).join(", ");
      const { data, error } = await supabase.functions.invoke("interpret-voice", {
        body: { text, productNames },
      });
      if (error) throw error;
      const interpretation = data as VoiceInterpretation;
      setResult(interpretation);
      if (interpretation.matched_product_id) {
        setSelectedProductId(interpretation.matched_product_id);
      }
      setEditTipo(interpretation.tipo);
      setEditCantidad(interpretation.cantidad);
    } catch (err) {
      toast({ title: "Error al interpretar el texto", variant: "destructive" });
    }
    setInterpreting(false);
  };

  const handleConfirm = () => {
    if (!selectedProductId) return toast({ title: "Seleccioná un producto", variant: "destructive" });
    onConfirm(selectedProductId, editTipo, editCantidad);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Registro por Voz con IA</CardTitle>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Di algo como "Entrada 50 Roble Gris SPC" o "Salida 12 Porcelanato Calacatta"
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Mic button */}
          <div className="flex flex-col items-center gap-3 py-4">
            <button
              onClick={listening ? stopListening : startListening}
              disabled={interpreting}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg
                ${listening
                  ? "bg-destructive animate-pulse scale-110"
                  : "bg-primary hover:bg-primary/90"
                } disabled:opacity-50`}
            >
              {listening ? <MicOff className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-white" />}
            </button>
            <p className="text-xs text-muted-foreground">
              {listening ? "Escuchando... (click para detener)" : "Click para hablar"}
            </p>
          </div>

          {/* Transcript */}
          {transcript && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Detectado:</p>
              <p className="text-sm font-medium italic">"{transcript}"</p>
            </div>
          )}

          {/* Interpreting indicator */}
          {interpreting && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Interpretando con IA...
            </div>
          )}

          {/* Result card */}
          {result && !interpreting && (
            <div className="space-y-3 border rounded-lg p-3 bg-card">
              {result.error ? (
                <p className="text-sm text-destructive">{result.error}</p>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Interpretación de la IA</span>
                    <Badge variant={result.confianza === "alta" ? "default" : "secondary"} className="ml-auto text-xs">
                      Confianza: {result.confianza}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Tipo</p>
                      <Select value={editTipo} onValueChange={v => setEditTipo(v as "entrada" | "salida")}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="entrada">↑ Entrada</SelectItem>
                          <SelectItem value="salida">↓ Salida</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Cantidad</p>
                      <Input
                        type="number" min={1} value={editCantidad}
                        onChange={e => setEditCantidad(Number(e.target.value))}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Producto detectado: <span className="text-foreground font-medium">{result.producto_nombre}</span></p>
                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar producto" /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>

        {result && !result.error && (
          <CardFooter className="gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setResult(null)}>Reintentar</Button>
            <Button className="flex-1" onClick={handleConfirm}>Confirmar movimiento</Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
