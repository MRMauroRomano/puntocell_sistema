
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Printer, DollarSign, Wallet, UserCircle, FileText, Loader2, Save } from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { Customer } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

export default function CurrentAccountPage() {
  const firestore = useFirestore()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  
  // Estados para diálogos
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState<string>("")
  const [isSaving, setIsSaving] = useState(false)

  const customersRef = useMemoFirebase(() => collection(firestore, 'customers'), [firestore])
  const { data: customers, isLoading } = useCollection<Customer>(customersRef)

  const filtered = useMemo(() => {
    if (!customers) return []
    return customers
      .filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.id.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => (b.balance || 0) - (a.balance || 0))
  }, [customers, searchTerm])

  const totalOutstanding = useMemo(() => {
    if (!filtered) return 0
    return filtered.reduce((acc, curr) => acc + (curr.balance || 0), 0)
  }, [filtered])

  const handleOpenPayment = (customer: Customer) => {
    setSelectedCustomer(customer)
    setPaymentAmount("")
    setIsPayDialogOpen(true)
  }

  const handleOpenStatus = (customer: Customer) => {
    setSelectedCustomer(customer)
    setIsStatusDialogOpen(true)
  }

  const handleProcessPayment = () => {
    const amount = parseFloat(paymentAmount)
    if (!selectedCustomer || isNaN(amount) || amount <= 0) {
      toast({
        variant: "destructive",
        title: "Monto inválido",
        description: "Por favor, ingresa un monto válido para cobrar."
      })
      return
    }

    setIsSaving(true)
    const newBalance = Math.max(0, (selectedCustomer.balance || 0) - amount)
    const customerRef = doc(firestore, 'customers', selectedCustomer.id)

    try {
      updateDocumentNonBlocking(customerRef, {
        balance: newBalance
      })
      
      toast({
        title: "Pago registrado",
        description: `Se cobraron $${amount.toFixed(2)} a ${selectedCustomer.name}.`
      })
      setIsPayDialogOpen(false)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo registrar el pago."
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handlePrintList = () => {
    if (typeof window !== 'undefined') window.print()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold font-headline text-primary">Cuenta Corriente</h1>
          <p className="text-muted-foreground text-sm">Gestión de créditos, deudas y pagos parciales de clientes.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
           <Button variant="outline" className="gap-2 flex-1 sm:flex-none" onClick={handlePrintList}>
             <Printer className="h-4 w-4" /> Imprimir
           </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        <div className="md:col-span-4 space-y-4 no-print">
          <Card className="bg-primary/5 border-primary/20">
             <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase text-primary/70">Deuda Total Cartera</CardTitle>
             </CardHeader>
             <CardContent>
                <div className="text-3xl font-bold text-primary font-headline">${totalOutstanding.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">Suma de todos los saldos pendientes</p>
             </CardContent>
          </Card>

          <Card className="border-primary/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-headline">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Nombre o ID..." 
                  className="pl-9 bg-muted/30 border-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-8">
          <Card className="shadow-sm border-primary/10 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/10 py-4 px-6">
               <div>
                 <CardTitle className="text-lg font-headline">Saldos de Clientes</CardTitle>
                 <CardDescription className="text-xs">Resumen de créditos vigentes</CardDescription>
               </div>
               {!isLoading && <Badge variant="secondary" className="font-bold">{filtered.length} Clientes</Badge>}
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground text-xs">Cargando cuentas...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Saldo Pendiente</TableHead>
                        <TableHead className="text-right no-print">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((customer) => (
                        <TableRow key={customer.id} className="hover:bg-primary/5">
                          <TableCell>
                            <div className="flex items-center gap-3">
                               <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                 <UserCircle className="h-5 w-5 text-primary" />
                               </div>
                               <div className="flex flex-col min-w-0">
                                 <span className="font-bold text-sm truncate">{customer.name}</span>
                                 <span className="text-[10px] text-muted-foreground font-mono">ID: {customer.id.slice(0, 8)}</span>
                               </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                             <span className={cn("font-black text-base", (customer.balance || 0) > 0 ? "text-red-600" : "text-green-600")}>
                               ${(customer.balance || 0).toFixed(2)}
                             </span>
                          </TableCell>
                          <TableCell className="text-right no-print">
                             <div className="flex justify-end gap-1">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 px-2 gap-1 text-[11px]"
                                  onClick={() => handleOpenStatus(customer)}
                                >
                                   <FileText className="h-3.5 w-3.5" /> Estado
                                </Button>
                                <Button 
                                  variant="secondary" 
                                  size="sm" 
                                  className="h-8 px-2 gap-1 text-primary text-[11px] font-bold"
                                  onClick={() => handleOpenPayment(customer)}
                                >
                                   <Wallet className="h-3.5 w-3.5" /> Cobrar
                                </Button>
                             </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-20 text-muted-foreground italic">
                            No hay clientes con deuda para mostrar.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Diálogo Cobrar */}
      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-headline">Registrar Cobro</DialogTitle>
            <DialogDescription>
              Registra un pago realizado por {selectedCustomer?.name}. El monto se descontará de su saldo actual.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
               <span className="text-xs font-bold text-red-800 uppercase">Deuda Actual</span>
               <span className="text-2xl font-black text-red-900">${(selectedCustomer?.balance || 0).toFixed(2)}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment">Monto a Cobrar ($)</Label>
              <Input 
                id="payment" 
                type="number" 
                placeholder="0.00" 
                autoFocus
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPayDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleProcessPayment} disabled={isSaving} className="gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Confirmar Cobro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo Estado de Cuenta */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl">Estado de Cuenta</DialogTitle>
            <DialogDescription>
              Resumen detallado de la situación financiera del cliente.
            </DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border bg-muted/30">
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Nombre</p>
                  <p className="font-bold text-sm">{selectedCustomer.name}</p>
                </div>
                <div className="p-4 rounded-xl border bg-muted/30">
                  <p className="text-[10px] font-black uppercase text-muted-foreground">CUIT/CUIL</p>
                  <p className="font-bold text-sm">{selectedCustomer.cuit || "---"}</p>
                </div>
              </div>
              <div className="p-6 rounded-2xl border-2 border-primary/20 bg-primary/5 text-center">
                 <p className="text-xs font-bold uppercase text-primary/60 mb-1">Saldo Final Pendiente</p>
                 <p className={cn("text-4xl font-black font-headline", selectedCustomer.balance > 0 ? "text-red-600" : "text-green-600")}>
                    ${selectedCustomer.balance.toFixed(2)}
                 </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-muted-foreground">Información de Contacto</p>
                <div className="text-sm space-y-1 bg-muted/20 p-3 rounded-lg">
                   <p><span className="font-medium">Email:</span> {selectedCustomer.email || "No registrado"}</p>
                   <p><span className="font-medium">Teléfono:</span> {selectedCustomer.phone || "No registrado"}</p>
                   <p><span className="font-medium">Dirección:</span> {selectedCustomer.address || "No registrada"}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button className="w-full gap-2" variant="outline" onClick={handlePrintList}>
               <Printer className="h-4 w-4" /> Imprimir Estado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
