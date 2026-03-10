
"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  CreditCard,
  Settings,
  ChevronRight,
  LogOut,
  Store,
  Wallet,
  ChevronDown,
  Wrench
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/firebase"
import { signOut } from "firebase/auth"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/" },
  { 
    title: "Ventas", 
    icon: ShoppingCart, 
    href: "/ventas",
    items: [
      { title: "Nueva Venta", href: "/ventas" },
      { title: "Arreglos / Servicios", href: "/ventas/arreglos" },
      { title: "Historial", href: "/ventas/historial" },
    ]
  },
  { 
    title: "Productos", 
    icon: Package, 
    href: "/productos",
    items: [
      { title: "Inventario", href: "/productos" },
      { title: "Stock Bajo", href: "/productos/stock-bajo" },
    ]
  },
  { title: "Clientes", icon: Users, href: "/clientes" },
  { title: "Gastos", icon: Wallet, href: "/gastos" },
  { title: "Cuenta Corriente", icon: CreditCard, href: "/cuenta-corriente" },
  { title: "Configuración", icon: Settings, href: "/configuracion" },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { state } = useSidebar()
  const auth = useAuth()

  const handleSignOut = () => {
    signOut(auth).then(() => {
      router.push("/login")
    })
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 flex flex-row items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Store className="h-5 w-5" />
        </div>
        {state !== "collapsed" && (
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight font-headline">CommerceManager</span>
            <span className="text-xs text-muted-foreground">Pro Edition</span>
          </div>
        )}
      </SidebarHeader>
      <Separator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const hasSubItems = item.items && item.items.length > 0
                const isActive = pathname === item.href || (hasSubItems && item.items?.some(sub => pathname === sub.href))

                if (hasSubItems) {
                  return (
                    <Collapsible key={item.title} asChild defaultOpen={isActive} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip={item.title} isActive={isActive}>
                            <item.icon />
                            <span>{item.title}</span>
                            <ChevronDown className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.items?.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton asChild isActive={pathname === subItem.href}>
                                  <Link href={subItem.href}>
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                      tooltip={item.title}
                      className="hover:bg-accent hover:text-accent-foreground"
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 border">
            <AvatarImage src="https://picsum.photos/seed/admin-avatar/100/100" />
            <AvatarFallback>AD</AvatarFallback>
          </Avatar>
          {state !== "collapsed" && (
            <div className="flex flex-1 flex-col text-left">
              <span className="text-sm font-medium">Administrador</span>
              <span className="text-xs text-muted-foreground truncate">admin@cmpro.com</span>
            </div>
          )}
          {state !== "collapsed" && (
             <SidebarMenuButton 
               size="icon" 
               className="text-muted-foreground hover:text-destructive"
               onClick={handleSignOut}
               title="Cerrar Sesión"
             >
               <LogOut className="h-4 w-4" />
             </SidebarMenuButton>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
