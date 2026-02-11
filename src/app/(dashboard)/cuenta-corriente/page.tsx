
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Printer, DollarSign, ArrowRight, Wallet, UserCircle, FileText } from "lucide-react"
import { MOCK_CUSTOMERS } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export default function CurrentAccountPage() {
  const [searchTerm, setSearchTerm] = useState("")

  const indebtedCustomers = MOCK_CUSTOMERS.filter(c => 
    (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.id.toLowerCase().includes(searchTerm.toLowerCase()))
  ).sort((a,b) => b.balance - a.balance)

  const totalOutstanding = indebtedCustomers.reduce((acc, curr) => acc + curr.balance, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold font-headline">Cuenta Corriente</h1>
          <p className="text-muted-foreground">Gestión de créditos, deudas y pagos parciales de clientes.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="gap-2">
             <Printer className="h-4 w-4" /> Imprimir Listado
           </Button>
           <Button className="gap-2 bg-green-600 hover:bg-green-700">
             <DollarSign className="h-4 w-4" /> Registrar Pago
           </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        <div className="md:col-span-4 space-y-4 no-print">
          <Card className="bg-primary/5 border-primary/20">
             <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-primary">Deuda Total Cartera</CardTitle>
             </CardHeader>
             <CardContent>
                <div className="text-3xl font-bold text-primary font-headline">${totalOutstanding.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">Suma de todos los saldos pendientes</p>
             </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filtros de Búsqueda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Nombre de cliente o ID..." 
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Estado</label>
                <div className="flex flex-wrap gap-2">
                   <Badge className="cursor-pointer">Todos</Badge>
                   <Badge variant="outline" className="cursor-pointer">Con Deuda</Badge>
                   <Badge variant="outline" className="cursor-pointer">Al Día</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10 py-4">
               <div>
                 <CardTitle className="text-lg">Saldos de Clientes</CardTitle>
                 <CardDescription>Resumen de créditos vigentes</CardDescription>
               </div>
               <Badge variant="secondary">{indebtedCustomers.length} Clientes</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Último Pago</TableHead>
                    <TableHead className="text-right">Saldo Pendiente</TableHead>
                    <TableHead className="text-right no-print">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {indebtedCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                           <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center">
                             <UserCircle className="h-5 w-5 text-accent-foreground" />
                           </div>
                           <div className="flex flex-col">
                             <span className="font-medium">{customer.name}</span>
                             <span className="text-[10px] text-muted-foreground">ID: {customer.id}</span>
                           </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        15 Oct, 2023
                      </TableCell>
                      <TableCell className="text-right">
                         <span className={cn("font-bold text-lg", customer.balance > 0 ? "text-red-600" : "text-green-600")}>
                           ${customer.balance.toFixed(2)}
                         </span>
                      </TableCell>
                      <TableCell className="text-right no-print">
                         <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" className="h-8 px-2 gap-1">
                               <FileText className="h-3.5 w-3.5" /> Estado
                            </Button>
                            <Button variant="secondary" size="sm" className="h-8 px-2 gap-1 text-primary">
                               <Wallet className="h-3.5 w-3.5" /> Cobrar
                            </Button>
                         </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
