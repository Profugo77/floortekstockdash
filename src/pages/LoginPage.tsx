import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Package } from "lucide-react";

export default function LoginPage() {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error, pendingApproval } = await signIn(email, password);
    setLoading(false);
    if (pendingApproval) {
      toast({
        title: "Cuenta pendiente de aprobación",
        description: "Contactá al administrador para que apruebe tu acceso.",
        variant: "destructive",
      });
      return;
    }
    if (error) {
      toast({ title: "Error al iniciar sesión", description: "Email o contraseña incorrectos.", variant: "destructive" });
    }
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
              <Button type="submit" className="w-full" disabled={loading}>
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
