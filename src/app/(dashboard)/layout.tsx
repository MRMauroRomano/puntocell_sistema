"use client"

import { useEffect } from "react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { Bell, Search, User, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth, useUser, initiateAnonymousSignIn } from "@/firebase"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const auth = useAuth()
  const { user, isUserLoading } = useUser()

  useEffect(() => {
    // Si no hay usuario y ya terminó de cargar el estado inicial, iniciamos sesión anónima
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth)
    }
  }, [user, isUserLoading, auth])

  // Pantalla de carga mientras se verifica la autenticación
  if (isUserLoading || !user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium animate-pulse">
          Estableciendo conexión segura...
        </p>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between px-6 border-b bg-white no-print">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-6" />
            <div className="relative hidden md:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar en el sistema..."
                className="w-[300px] pl-8 bg-muted/50 border-none focus-visible:ring-1"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full border-2 border-white"></span>
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Button variant="ghost" className="gap-2 px-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium hidden sm:inline-block">
                {user.isAnonymous ? "Personal de Tienda" : (user.email || "Usuario")}
              </span>
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6 bg-background">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
