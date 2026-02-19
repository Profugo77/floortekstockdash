import { useLocation, Link } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, Package, ArrowLeftRight, CalendarDays, BarChart3, Settings, LogOut, Package2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Productos", url: "/productos", icon: Package },
  { title: "Movimientos", url: "/movimientos", icon: ArrowLeftRight },
  { title: "Resumen Diario", url: "/resumen", icon: CalendarDays },
  { title: "Análisis", url: "/analisis", icon: BarChart3 },
  { title: "Configuración", url: "/configuracion", icon: Settings },
];

export default function AppSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Package2 className="w-4.5 h-4.5 text-primary-foreground w-[18px] h-[18px]" />
          </div>
          <div className="overflow-hidden group-data-[collapsible=icon]:hidden">
            <p className="font-bold text-sidebar-foreground text-sm leading-tight">FloorTek Stock</p>
            <p className="text-[10px] text-sidebar-foreground/40 leading-tight">Control de inventario</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className="group-data-[collapsible=icon]:hidden text-xs text-sidebar-foreground/40 truncate px-1 mb-1">
          {user?.email}
        </div>
        <SidebarMenuButton
          onClick={signOut}
          tooltip="Cerrar sesión"
          className="text-sidebar-foreground/60 hover:text-red-400 hover:bg-red-500/10"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Cerrar sesión</span>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
