
"use client"

import { useState, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Printer, Wallet, UserCircle, FileText, Loader2, Save, ArrowRightLeft, History as HistoryIcon, CheckCircle2, XCircle, FileUp, Plus } from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking, useUser, deleteDocumentNonBlocking } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { Customer, AccountMovement } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import * as XLSX from 'xlsx'

export default function CurrentAccountPage() {
  const firestore = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState<string>("martin")
  const [activeYear, setActiveYear] = useState<string>("2025")
  const [usdRate, setUsdRate] = useState<string>("1200")
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [isChargeDialogOpen, setIsChargeDialogOpen] = useState(false)
  
  const [paymentAmount, setPaymentAmount] = useState<string>("")
  const [paymentNotes, setPaymentNotes] = useState<string>("")
  
  const [chargeAmount, setChargeAmount] = useState<string>("")
  const [chargeNotes, setChargeNotes] = useState<string>("")
  const [chargeCustomerId, setChargeCustomerId] = useState<string>("")
  
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  // Clientes
  const customersRef = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'customers') : null, 
  [firestore, user])
  const { data: customers, isLoading } = useCollection<Customer>(customersRef)

  // Movimientos del cliente seleccionado
  const movementsRef = useMemoFirebase(() => 
    user && selectedCustomer ? collection(firestore, 'users', user.uid, 'customers', selectedCustomer.id, 'movements') : null,
  [firestore, user, selectedCustomer])
  const { data: movements, isLoading: isLoadingMovements } = useCollection<AccountMovement>(movementsRef)

  const filtered = useMemo(() => {
    if (!customers) return []
    return customers
      .filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             c.id.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesType = (c.accountType || 'martin') === activeTab
        const matchesYear = (c.accountYear || "2025") === activeYear
        return matchesSearch && matchesType && matchesYear
      })
      .sort((a, b) => (b.balance || 0) - (a.balance || 0))
  }, [customers, searchTerm, activeTab, activeYear])

  const totalsByTab = useMemo(() => {
    const initial = { martin: 0, toti: 0, martinUSD: 0, totiUSD: 0 }
    if (!customers) return initial
    return customers.reduce((acc, curr) => {
      if ((curr.accountYear || "2025") === activeYear) {
        const type = (curr.accountType === 'toti' ? 'toti' : 'martin') as 'martin' | 'toti'
        acc[type] += (curr.balance || 0)
        const usdKey = (type === 'martin' ? 'martinUSD' : 'totiUSD') as 'martinUSD' | 'totiUSD'
        acc[usdKey] += (curr.balanceUSD || 0)
      }
      return acc
    }, initial)
  }, [customers, activeYear])

  const handleOpenPayment = (customer: Customer) => {
    setSelectedCustomer(customer)
    setPaymentAmount("")
    setPaymentNotes("")
    setIsPayDialogOpen(true)
  }

  const handleOpenStatus = (customer: Customer) => {
    setSelectedCustomer(customer)
    setIsStatusDialogOpen(true)
  }

  const handleProcessPayment = () => {
    const amount = parseFloat(paymentAmount)
    if (!user || !selectedCustomer || isNaN(amount) || amount <= 0) {
      toast({ variant: "destructive", title: "Operación no válida", description: "Ingresa un monto válido." })
      return
    }

    setIsSaving(true)
    const newBalance = Math.max(0, (selectedCustomer.balance || 0) - amount)
    const customerRef = doc(firestore, 'users', user.uid, 'customers', selectedCustomer.id)
    
    // Conciliación Automática: Buscar ítems pendientes y marcarlos como pagados si el monto alcanza
    let remainingPayment = amount;
    if (movements) {
      // Ordenar por fecha (más antiguos primero)
      const sortedPending = movements
        .filter(m => m.type === 'charge' && m.status === 'pending')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      for (const m of sortedPending) {
        if (remainingPayment <= 0) break;
        // Si el pago cubre el total del ítem, lo marcamos como pagado
        if (remainingPayment >= m.amount) {
          const mRef = doc(firestore, 'users', user.uid, 'customers', selectedCustomer.id, 'movements', m.id);
          updateDocumentNonBlocking(mRef, { status: 'paid' });
          remainingPayment -= m.amount;
        } else {
          // Pago parcial: No marcamos como pagado aún, pero paramos la conciliación automática
          break;
        }
      }
    }
    
    // Crear movimiento de pago
    const movementId = Math.random().toString(36).substr(2, 9)
    const movementRef = doc(firestore, 'users', user.uid, 'customers', selectedCustomer.id, 'movements', movementId)
    
    setDocumentNonBlocking(movementRef, {
      id: movementId,
      date: new Date().toISOString(),
      description: `ENTREGA / PAGO: ${paymentNotes || 'Sin descripción'}`,
      amount: amount,
      type: 'payment',
      status: 'paid'
    }, { merge: true })

    const timestamp = format(new Date(), "dd/MM/yyyy")
    const newNote = `[${timestamp}] PAGO: -$${amount.toLocaleString('es-AR')}${paymentNotes ? ` (${paymentNotes})` : ''}\n`
    const updatedNotes = newNote + (selectedCustomer.notes || "")

    try {
      updateDocumentNonBlocking(customerRef, {
        balance: newBalance,
        notes: updatedNotes,
        updatedAt: new Date().toISOString()
      })
      toast({ title: "Pago registrado", description: `Se cobraron $${amount.toFixed(2)} y se conciliaron deudas.` })
      setIsPayDialogOpen(false)
    } catch (error) { /* Handled centrally */ } finally { setIsSaving(false) }
  }

  const handlePaySpecificItem = (movement: AccountMovement) => {
    if (!user || !selectedCustomer || movement.status === 'paid') return

    setIsSaving(true)
    const amount = movement.amount
    const newBalance = Math.max(0, (selectedCustomer.balance || 0) - amount)
    const customerRef = doc(firestore, 'users', user.uid, 'customers', selectedCustomer.id)
    const movementRef = doc(firestore, 'users', user.uid, 'customers', selectedCustomer.id, 'movements', movement.id)

    // Marcar ítem como pagado
    updateDocumentNonBlocking(movementRef, { status: 'paid' })

    const timestamp = format(new Date(), "dd/MM/yyyy")
    const newNote = `[${timestamp}] COBRO ÍTEM: -$${amount.toLocaleString('es-AR')} (${movement.description})\n`
    const updatedNotes = newNote + (selectedCustomer.notes || "")

    try {
      updateDocumentNonBlocking(customerRef, {
        balance: newBalance,
        notes: updatedNotes,
        updatedAt: new Date().toISOString()
      })
      toast({ title: "Ítem cobrado", description: `Se saldó "${movement.description}" por $${amount}.` })
    } catch (error) { /* Handled centrally */ } finally { setIsSaving(false) }
  }

  const handleProcessCharge = () => {
    const amount = parseFloat(chargeAmount)
    if (!user || !chargeCustomerId || isNaN(amount) || amount <= 0) {
      toast({ variant: "destructive", title: "Operación no válida", description: "Selecciona cliente e ingresa monto." })
      return
    }

    setIsSaving(true)
    const customer = customers?.find(c => c.id === chargeCustomerId)
    if (!customer) return

    // Crear movimiento de cargo
    const movementId = Math.random().toString(36).substr(2, 9)
    const movementRef = doc(firestore, 'users', user.uid, 'customers', customer.id, 'movements', movementId)
    
    setDocumentNonBlocking(movementRef, {
      id: movementId,
      date: new Date().toISOString(),
      description: chargeNotes || 'Anotación Manual',
      amount: amount,
      type: 'charge',
      status: 'pending'
    }, { merge: true })

    const newBalance = (customer.balance || 0) + amount
    const customerRef = doc(firestore, 'users', user.uid, 'customers', customer.id)
    const timestamp = format(new Date(), "dd/MM/yyyy")
    const newNote = `[${timestamp}] CARGO: +$${amount.toLocaleString('es-AR')} - ${chargeNotes || "Sin descripción"}\n`
    const updatedNotes = newNote + (customer.notes || "")

    try {
      updateDocumentNonBlocking(customerRef, { balance: newBalance, notes: updatedNotes, updatedAt: new Date().toISOString() })
      toast({ title: "Cargo registrado" })
      setIsChargeDialogOpen(false)
      setChargeAmount(""); setChargeNotes(""); setChargeCustomerId("")
    } catch (error) { /* Handled centrally */ } finally { setIsSaving(false) }
  }

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[]
        let importedCount = 0
        jsonData.forEach(row => {
          const normalized = Object.keys(row).reduce((acc: any, key) => { acc[key.toLowerCase().trim()] = row[key]; return acc; }, {});
          const name = normalized.nombre || normalized.name || normalized.cliente || "";
          if (name) {
            const id = Math.random().toString(36).substr(2, 9)
            const balance = parseFloat(String(normalized.deuda || normalized.saldo || "0").replace(/[^0-9.-]+/g, "")) || 0
            const customerData = { id, name: String(name), balance, accountType: activeTab as any, accountYear: activeYear, updatedAt: new Date().toISOString() }
            const customerRef = doc(firestore, 'users', user.uid, 'customers', id)
            setDocumentNonBlocking(customerRef, customerData, { merge: true })
            importedCount++
          }
        })
        toast({ title: "Importación exitosa", description: `Se cargaron ${importedCount} registros.` })
      } catch (err) { toast({ variant: "destructive", title: "Error al importar" }) } finally { setIsImporting(false); if (fileInputRef.current) fileInputRef.current.value = "" }
    }
    reader.readAsArrayBuffer(file)
  }

  const martinUSDTotal = (totalsByTab.martinUSD > 0) ? totalsByTab.martinUSD : (totalsByTab.martin / (parseFloat(usdRate) || 1));
  const totiUSDTotal = (totalsByTab.totiUSD > 0) ? totalsByTab.totiUSD : (totalsByTab.toti / (parseFloat(usdRate) || 1));

  const pendingMovements = useMemo(() => {
    if (!movements) return []
    return movements.filter(m => m.type === 'charge' && m.status === 'pending').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [movements])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold font-headline text-primary">Libro de Cuentas</h1>
          <p className="text-muted-foreground text-sm">Control detallado de cobros individuales y deudas.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
           <Button className="gap-2 flex-1 sm:flex-none" onClick={() => setIsChargeDialogOpen(true)}>
             <Plus className="h-4 w-4" /> Anotar Cargo
           </Button>
           <input type="file" className="hidden" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx, .xls" />
           <Button variant="outline" className="gap-2 flex-1 sm:flex-none" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
             <FileUp className="h-4 w-4" /> Importar Excel
           </Button>
           <Button variant="outline" className="gap-2 flex-1 sm:flex-none" onClick={() => window.print()}>
             <Printer className="h-4 w-4" /> Imprimir
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
           <CardHeader className="pb-1 px-4 pt-4">
              <CardTitle className="text-[10px] font-black uppercase text-primary/70">Total Martin ({activeYear})</CardTitle>
           </CardHeader>
           <CardContent className="px-4 pb-4">
              <div className="text-2xl font-black text-primary font-headline">${totalsByTab.martin.toLocaleString('es-AR')}</div>
              <div className="text-[10px] font-bold text-primary/60">≈ USD {martinUSDTotal.toLocaleString('en-US', { currency: 'USD' })}</div>
           </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
           <CardHeader className="pb-1 px-4 pt-4">
              <CardTitle className="text-[10px] font-black uppercase text-amber-700/70">Total Toti ({activeYear})</CardTitle>
           </CardHeader>
           <CardContent className="px-4 pb-4">
              <div className="text-2xl font-black text-amber-700 font-headline">${totalsByTab.toti.toLocaleString('es-AR')}</div>
              <div className="text-[10px] font-bold text-amber-700/60">≈ USD {totiUSDTotal.toLocaleString('en-US', { currency: 'USD' })}</div>
           </CardContent>
        </Card>
        <Card className="bg-white border-muted col-span-1 lg:col-span-2">
          <CardHeader className="pb-1 px-4 pt-3">
             <CardTitle className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">Cotización USD Hoy</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 flex items-center gap-4">
            <Input type="number" value={usdRate} onChange={(e) => setUsdRate(e.target.value)} className="h-9 font-bold text-sm bg-muted/20" />
            <p className="text-[9px] text-muted-foreground italic leading-tight">Valor de referencia para convertir deudas ARS a USD.</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-4 items-center no-print">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="martin" className="text-[10px] font-black uppercase">Martin</TabsTrigger>
            <TabsTrigger value="toti" className="text-[10px] font-black uppercase">Toti</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-md border">
           {["2024", "2025", "2026"].map(y => (
             <Button key={y} variant={activeYear === y ? "default" : "ghost"} size="sm" className="h-7 text-xs font-bold" onClick={() => setActiveYear(y)}>{y}</Button>
           ))}
        </div>
        <div className="relative flex-1 max-w-sm ml-auto">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente..." className="pl-9 h-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <Card className="shadow-lg border-primary/10 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/10">
            <TableRow>
              <TableHead className="font-black text-[10px] uppercase">Cliente</TableHead>
              <TableHead className="text-right font-black text-[10px] uppercase">Saldo Pesos</TableHead>
              <TableHead className="text-right font-black text-[10px] uppercase">Ref. Dólar</TableHead>
              <TableHead className="font-black text-[10px] uppercase">Último Movimiento</TableHead>
              <TableHead className="text-right font-black text-[10px] uppercase">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(customer => (
              <TableRow key={customer.id} className="hover:bg-primary/5">
                <TableCell className="font-bold">{customer.name}</TableCell>
                <TableCell className="text-right font-black text-red-600">${(customer.balance || 0).toLocaleString('es-AR')}</TableCell>
                <TableCell className="text-right text-xs font-medium text-muted-foreground">USD {((customer.balance || 0) / (parseFloat(usdRate) || 1)).toLocaleString('en-US')}</TableCell>
                <TableCell className="text-[10px] text-muted-foreground italic line-clamp-1 max-w-[200px]">{customer.notes?.split('\n')[0] || "---"}</TableCell>
                <TableCell className="text-right space-x-2">
                   <Button variant="ghost" size="sm" onClick={() => handleOpenStatus(customer)} className="h-8 w-8 p-0"><FileText className="h-4 w-4" /></Button>
                   <Button variant="secondary" size="sm" onClick={() => handleOpenPayment(customer)} className="h-8 font-bold text-[10px] uppercase gap-1"><Wallet className="h-3.5 w-3.5" /> Cobrar</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Ficha Histórica con Cobro Individual */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2 font-headline text-xl">Ficha de {selectedCustomer?.name}</DialogTitle>
            <DialogDescription>Detalle de fiados y opción de cobro por ítem.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
               <Card className="bg-red-50 border-red-100 p-4 text-center">
                  <p className="text-[10px] font-black uppercase text-red-800/60 mb-1">Saldo Total</p>
                  <p className="text-3xl font-black text-red-600">${selectedCustomer?.balance.toLocaleString('es-AR')}</p>
               </Card>
               <Card className="bg-primary/5 border-primary/10 p-4 text-center">
                  <p className="text-[10px] font-black uppercase text-primary/60 mb-1">Ahorro en USD</p>
                  <p className="text-3xl font-black text-primary">USD {((selectedCustomer?.balance || 0) / (parseFloat(usdRate) || 1)).toLocaleString('en-US')}</p>
               </Card>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2">
                <HistoryIcon className="h-4 w-4" /> Ítems Pendientes (Cobro por separado)
              </h3>
              {isLoadingMovements ? (
                <div className="py-10 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></div>
              ) : pendingMovements.length === 0 ? (
                <p className="py-10 text-center text-sm italic text-muted-foreground border rounded-lg border-dashed">No hay cargos individuales pendientes.</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableBody>
                      {pendingMovements.map(m => (
                        <TableRow key={m.id} className="hover:bg-muted/30">
                          <TableCell className="text-[10px] font-bold text-muted-foreground">{format(new Date(m.date), 'dd/MM/yy')}</TableCell>
                          <TableCell className="text-xs font-medium">{m.description}</TableCell>
                          <TableCell className="text-sm font-black text-red-600 text-right">${m.amount.toLocaleString('es-AR')}</TableCell>
                          <TableCell className="text-right">
                             <Button size="sm" onClick={() => handlePaySpecificItem(m)} disabled={isSaving} className="h-7 text-[9px] font-black uppercase bg-green-600 hover:bg-green-700">Saldar Ítem</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="space-y-2">
               <h3 className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2">Historial Visual (Libro)</h3>
               <div className="p-3 bg-muted/20 border rounded-lg font-mono text-[10px] leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                 {selectedCustomer?.notes || "Sin registros."}
               </div>
            </div>
          </div>
          <DialogFooter className="p-6 border-t bg-muted/10">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => window.print()}>Imprimir Ficha</Button>
            <Button className="w-full sm:w-auto" onClick={() => setIsStatusDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo Cobro General */}
      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Cobro General / Entrega</DialogTitle>
            <DialogDescription>
              {selectedCustomer ? `Registra un pago para ${selectedCustomer.name}. Se saldarán automáticamente las deudas más antiguas.` : 'Registra un pago que descuenta del saldo total.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="space-y-2">
                <Label>Monto a entregar ($)</Label>
                <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="h-12 text-xl font-bold" placeholder="0.00" autoFocus />
                {paymentAmount && usdRate && (
                  <p className="text-[10px] font-bold text-primary italic">
                    ≈ USD {(parseFloat(paymentAmount) / parseFloat(usdRate)).toLocaleString('en-US')} (al valor de hoy)
                  </p>
                )}
             </div>
             <div className="space-y-2">
                <Label>Nota de Pago (Opcional)</Label>
                <Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Ej: Pago en efectivo" />
             </div>
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setIsPayDialogOpen(false)}>Cancelar</Button>
             <Button onClick={handleProcessPayment} disabled={isSaving || !paymentAmount} className="gap-2">
               {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />} Confirmar
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo Nuevo Cargo */}
      <Dialog open={isChargeDialogOpen} onOpenChange={setIsChargeDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader><DialogTitle>Nuevo Cargo Directo</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Seleccionar Cliente</Label>
              <Select onValueChange={setChargeCustomerId} value={chargeCustomerId}>
                <SelectTrigger><SelectValue placeholder="Elegir..." /></SelectTrigger>
                <SelectContent>{customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.accountType})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monto ($)</Label>
              <Input type="number" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descripción / Producto</Label>
              <Textarea value={chargeNotes} onChange={(e) => setChargeNotes(e.target.value)} placeholder="Ej: Se llevó funda de silicona" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChargeDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleProcessCharge} disabled={isSaving || !chargeCustomerId} className="gap-2">Guardar Cargo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
