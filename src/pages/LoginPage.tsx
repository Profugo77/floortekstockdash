import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Package, Zap, X } from "lucide-react";

const ADMIN_QUICK_KEY = "floortek_admin_quick_access";

export default function LoginPage() {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);
  const [hasQuickAccess, setHasQuickAccess] = useState(false);

  useEffect(() => {
    setHasQuickAccess(!!localStorage.getItem(ADMIN_QUICK_KEY));
  }, []);

  const doSignIn = async (mail: string, pass: string) => {
    const { error, pendingApproval } = await signIn(mail, pass);
    if (pendingApproval) {
      toast({
        title: "Cuenta pendiente de aprobación",
        description: "Contactá al administrador para que apruebe tu acceso.",
        variant: "destructive",
      });
      return false;
    }
    if (error) {
      toast({ title: "Error al iniciar sesión", description: "Email o contraseña incorrectos.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const ok = await doSignIn(email, password);
    setLoading(false);
    if (!ok) return;
    // Ofrecer guardar como acceso rápido admin si aún no está guardado
    if (!localStorage.getItem(ADMIN_QUICK_KEY)) {
      const save = window.confirm(
        "¿Guardar estas credenciales como acceso rápido de administrador en este dispositivo?\n\n(Solo hacelo en un dispositivo de confianza)"
      );
      if (save) {
        localStorage.setItem(ADMIN_QUICK_KEY, JSON.stringify({ email, password }));
        setHasQuickAccess(true);
        toast({ title: "Acceso rápido activado", description: "La próxima vez podés ingresar con un click." });
      }
    }
  };

  const handleQuickAccess = async () => {
    const raw = localStorage.getItem(ADMIN_QUICK_KEY);
    if (!raw) return;
    try {
      const { email: e, password: p } = JSON.parse(raw);
      setQuickLoading(true);
      const ok = await doSignIn(e, p);
      setQuickLoading(false);
      if (!ok) {
        // credenciales inválidas guardadas → limpiar
        localStorage.removeItem(ADMIN_QUICK_KEY);
        setHasQuickAccess(false);
      }
    } catch {
      localStorage.removeItem(ADMIN_QUICK_KEY);
      setHasQuickAccess(false);
      setQuickLoading(false);
    }
  };

  const handleClearQuickAccess = () => {
    localStorage.removeItem(ADMIN_QUICK_KEY);
    setHasQuickAccess(false);
    toast({ title: "Acceso rápido eliminado" });
  };

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <Package className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">FloorTek Stock</h1>
          <p className="text-sm text-white/50 mt-1">Control inteligente de inventario</p>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardHeader className="pb-4">
            <h2 className="text-lg font-semibold text-foreground">Iniciar sesión</h2>
            <p className="text-sm text-muted-foreground">Ingresá tus credenciales para continuar</p>
          </CardHeader>
          <CardContent>
            {hasQuickAccess && (
              <div className="mb-4 space-y-2">
                <Button
                  type="button"
                  onClick={handleQuickAccess}
                  disabled={quickLoading || loading}
                  className="w-full"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {quickLoading ? "Ingresando..." : "Acceso rápido admin"}
                </Button>
                <button
                  type="button"
                  onClick={handleClearQuickAccess}
                  className="w-full text-xs text-muted-foreground hover:text-destructive flex items-center justify-center gap-1 py-1"
                >
                  <X className="w-3 h-3" /> Eliminar acceso rápido
                </button>
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-2 text-muted-foreground">o ingresá manualmente</span>
                  </div>
                </div>
              </div>
            )}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@empresa.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || quickLoading}>
                {loading ? "Ingresando..." : "Ingresar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-white/30 mt-6">
          FloorTek Stock · Sistema de inventario privado
        </p>
      </div>
    </div>
  );
}
