import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Package } from "lucide-react";

export default function LoginPage() {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({ title: "Error al iniciar sesión", description: "Email o contraseña incorrectos.", variant: "destructive" });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Error al registrarse", description: error.message, variant: "destructive" });
      return;
    }
    // Make first user admin
    if (data.user) {
      const { count } = await supabase.from("user_roles").select("*", { count: "exact", head: true });
      if (count === 0) {
        await supabase.from("user_roles").insert({ user_id: data.user.id, role: "admin" });
      }
    }
    toast({ title: "Cuenta creada. Ahora podés iniciar sesión." });
    setMode("login");
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
            <h2 className="text-lg font-semibold text-foreground">
              {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? "Ingresá tus credenciales para continuar" : "Completá los datos para registrarte"}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="space-y-4">
              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Nombre completo</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Juan García"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
              )}
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
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (mode === "login" ? "Ingresando..." : "Creando cuenta...") : (mode === "login" ? "Ingresar" : "Crear cuenta")}
              </Button>
            </form>

            <div className="mt-4 text-center">
              {mode === "login" ? (
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  ¿Primera vez? Crear cuenta
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Ya tengo cuenta → Iniciar sesión
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-white/30 mt-6">
          FloorTek Stock · Sistema de inventario privado
        </p>
      </div>
    </div>
  );
}
