
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, UserPlus, Phone, Mail, MoreHorizontal, History } from "lucide-react"
import { MOCK_CUSTOMERS } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState("")

  const filtered = MOCK_CUSTOMERS.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold font-headline">Directorio de Clientes</h1>
          <p className="text-muted-foreground">Gestiona la información y contacto de tus clientes.</p>
        </div>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" /> Nuevo Cliente
        </Button>
      </div>

      <div className="grid gap-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nombre, email o teléfono..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((customer) => (
            <Card key={customer.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 flex flex-row items-center gap-4 space-y-0">
                <Avatar className="h-12 w-12 border bg-primary/10">
                  <AvatarFallback className="text-primary font-bold">
                    {customer.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">{customer.name}</CardTitle>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">ID: {customer.id}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{customer.phone}</span>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Saldo Pendiente</span>
                    <span className={cn("text-lg font-bold", customer.balance > 0 ? "text-red-600" : "text-green-600")}>
                      ${customer.balance.toFixed(2)}
                    </span>
                  </div>
                  <Button variant="secondary" size="sm" className="gap-1">
                    <History className="h-4 w-4" /> Ver Historial
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground bg-white rounded-xl border border-dashed">
            No se encontraron clientes que coincidan con la búsqueda.
          </div>
        )}
      </div>
    </div>
  )
}
