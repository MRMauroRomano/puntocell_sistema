
"use client"

import { useState, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Printer, Wallet, UserCircle, FileText, Loader2, Save, CreditCard, Filter, Info, FileUp, PlusCircle, Calendar, DollarSign } from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking, useUser } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { Customer, PaymentMethod } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
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
  const [usdRate, setUsdRate] = useState<string>("1200") // Valor por defecto
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [isChargeDialogOpen, setIsChargeDialogOpen] = useState(false)
  
  const [paymentAmount, setPaymentAmount] = useState<string>("")
  
  const [chargeAmount, setChargeAmount] = useState<string>("")
  const [chargeNotes, setChargeNotes] = useState<string>("")
  const [chargeCustomerId, setChargeCustomerId] = useState<string>("")
  
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const customersRef = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'customers') : null, 
  [firestore, user])
  const { data: customers, isLoading } = useCollection<Customer>(customersRef)

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
      .sort((a, b) => {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return dateB - dateA
      })
  }, [customers, searchTerm, activeTab, activeYear])

  const totalsByTab = useMemo(() => {
    if (!customers) return { martin: 0, toti: 0, martinUSD: 0, totiUSD: 0 }
    return customers.reduce((acc, curr) => {
      if ((curr.accountYear || "2025") === activeYear) {
        const type = curr.accountType || 'martin'
        acc[type] = (acc[type] || 0) + (curr.balance || 0)
        const usdVal = type === 'martin' ? 'martinUSD' : 'totiUSD'
        acc[usdVal] = (acc[usdVal] || 0) + (curr.balanceUSD || 0)
      }
      return acc
    }, { martin: 0, toti: 0, martinUSD: 0, totiUSD: 0 })
  }, [customers, activeYear])

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
    if (!user || !selectedCustomer || isNaN(amount) || amount <= 0) {
      toast({
        variant: "destructive",
        title: "Operación no válida",
        description: "Por favor, ingresa un monto válido para cobrar."
      })
      return
    }

    setIsSaving(true)
    const newBalance = Math.max(0, (selectedCustomer.balance || 0) - amount)
    const customerRef = doc(firestore, 'users', user.uid, 'customers', selectedCustomer.id)

    try {
      updateDocumentNonBlocking(customerRef, {
        balance: newBalance,
        updatedAt: new Date().toISOString()
      })
      
      toast({
        title: "Pago registrado",
        description: `Se cobraron $${amount.toFixed(2)} a ${selectedCustomer.name}.`
      })
      setIsPayDialogOpen(false)
    } catch (error) {
      // Handled centrally
    } finally {
      setIsSaving(false)
    }
  }

  const handleProcessCharge = () => {
    const amount = parseFloat(chargeAmount)
    if (!user || !chargeCustomerId || isNaN(amount) || amount <= 0) {
      toast({
        variant: "destructive",
        title: "Operación no válida",
        description: "Selecciona un cliente e ingresa un monto válido."
      })
      return
    }

    setIsSaving(true)
    const customer = customers?.find(c => c.id === chargeCustomerId)
    if (!customer) return

    const newBalance = (customer.balance || 0) + amount
    const customerRef = doc(firestore, 'users', user.uid, 'customers', customer.id)

    try {
      updateDocumentNonBlocking(customerRef, {
        balance: newBalance,
        notes: chargeNotes || customer.notes || "",
        updatedAt: new Date().toISOString()
      })
      
      toast({
        title: "Cargo registrado",
        description: `Se cargaron $${amount.toFixed(2)} a la cuenta de ${customer.name}.`
      })
      setIsChargeDialogOpen(false)
      setChargeAmount("")
      setChargeNotes("")
    } catch (error) {
      // Handled centrally
    } finally {
      setIsSaving(false)
    }
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
          const normalized = Object.keys(row).reduce((acc: any, key) => {
            acc[key.toLowerCase().trim()] = row[key];
            return acc;
          }, {});

          const name = normalized.nombre || normalized.name || normalized.cliente || "";
          if (name) {
            const id = Math.random().toString(36).substr(2, 9)
            // Agarra datos de la columna Deuda para Pesos
            const balance = parseFloat(String(normalized.deuda || normalized.saldo || normalized.debe || normalized.total || normalized.quedaba || "0").replace(/[^0-9.-]+/g, "")) || 0
            // Agarra datos de la columna Valor en Dolares (USD) para USD
            const balanceUSD = parseFloat(String(normalized.dolares || normalized["valor en dolares (usd)"] || normalized.usd || normalized["saldo usd"] || "0").replace(/[^0-9.-]+/g, "")) || 0
            
            const delivery = parseFloat(String(normalized.entrega || normalized.pago || "0").replace(/[^0-9.-]+/g, "")) || 0
            
            const product = String(normalized.producto || normalized.equipo || "")
            const rawNotes = String(normalized.entrego || normalized.notas || normalized.observaciones || normalized.loqueentrego || "")
            
            const rawType = String(normalized.tipo || normalized.cartera || normalized.cuenta || "martin").toLowerCase()
            const accountType = rawType.includes('toti') ? 'toti' : 'martin'
            const rawYear = String(normalized.anio || normalized.year || normalized.periodo || activeYear)
            const accountYear = rawYear.includes('2024') ? '2024' : rawYear.includes('2026') ? '2026' : '2025'
            
            let importedDate = new Date().toISOString()
            const rawDateVal = normalized.fechas || normalized.fecha || normalized.dia || normalized.date
            
            if (rawDateVal) {
              if (typeof rawDateVal === 'number') {
                const d = new Date((rawDateVal - 25569) * 86400 * 1000)
                if (!isNaN(d.getTime())) importedDate = d.toISOString()
              } else {
                const dateStr = String(rawDateVal).trim()
                const parts = dateStr.split(/[/.-]/)
                if (parts.length === 3) {
                  const day = parseInt(parts[0], 10)
                  const month = parseInt(parts[1], 10) - 1
                  let year = parseInt(parts[2], 10)
                  if (parts[2].length === 2) year = 2000 + year
                  const d = new Date(year, month, day)
                  if (!isNaN(d.getTime())) importedDate = d.toISOString()
                } else {
                  const d = new Date(rawDateVal)
                  if (!isNaN(d.getTime())) importedDate = d.toISOString()
                }
              }
            }

            const formattedExcelDate = new Date(importedDate).toLocaleDateString('es-AR')
            let finalNotes = ""
            if (product && product !== "undefined" && product !== "") finalNotes += `Equipo: ${product}\n`
            if (delivery > 0) finalNotes += `Entrega previa registrada: $${delivery.toFixed(2)} (Fecha: ${formattedExcelDate})\n`
            if (rawNotes && rawNotes !== "undefined" && rawNotes !== "") finalNotes += `Notas: ${rawNotes}`

            const customerData = {
              id,
              name: String(name),
              balance,
              balanceUSD,
              notes: finalNotes,
              accountType,
              accountYear,
              createdAt: importedDate,
              updatedAt: importedDate
            }
            
            const customerRef = doc(firestore, 'users', user.uid, 'customers', id)
            setDocumentNonBlocking(customerRef, customerData, { merge: true })
            importedCount++
          }
        })
        
        toast({ title: "Importación exitosa", description: `Se cargaron ${importedCount} registros con deudas en Pesos y USD.` })
      } catch (err) {
        toast({ variant: "destructive", title: "Error al importar" })
      } finally {
        setIsImporting(false)
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // Si no hay USD en el excel, usamos la cotización para calcular. Si hay USD, sumamos el fijo.
  const martinUSDTotal = (totalsByTab.martinUSD > 0) ? totalsByTab.martinUSD : (totalsByTab.martin / (parseFloat(usdRate) || 1));
  const totiUSDTotal = (totalsByTab.totiUSD > 0) ? totalsByTab.totiUSD : (totalsByTab.toti / (parseFloat(usdRate) || 1));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold font-headline text-primary">Cuenta Corriente</h1>
          <p className="text-muted-foreground text-sm">Planilla de saldos y entregas por año.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
           <Button className="gap-2 flex-1 sm:flex-none" onClick={() => setIsChargeDialogOpen(true)}>
             <PlusCircle className="h-4 w-4" /> Nuevo Cargo
           </Button>
           <input type="file" className="hidden" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx, .xls" />
           <Button variant="outline" className="gap-2 flex-1 sm:flex-none" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
             {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} 
             Importar Excel
           </Button>
           <Button variant="outline" className="gap-2 flex-1 sm:flex-none" onClick={() => window.print()}>
             <Printer className="h-4 w-4" /> Imprimir
           </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="no-print space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-primary/5 border-primary/20">
               <CardHeader className="pb-1 px-4 pt-4">
                  <CardTitle className="text-[10px] font-black uppercase text-primary/70">Total Martin ({activeYear})</CardTitle>
               </CardHeader>
               <CardContent className="px-4 pb-4">
                  <div className="text-2xl font-black text-primary font-headline">${totalsByTab.martin.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                  <div className="text-[10px] font-bold text-primary/60">USD {martinUSDTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</div>
               </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-200">
               <CardHeader className="pb-1 px-4 pt-4">
                  <CardTitle className="text-[10px] font-black uppercase text-amber-700/70">Total Toti ({activeYear})</CardTitle>
               </CardHeader>
               <CardContent className="px-4 pb-4">
                  <div className="text-2xl font-black text-amber-700 font-headline">${totalsByTab.toti.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                  <div className="text-[10px] font-bold text-amber-700/60">USD {totiUSDTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</div>
               </CardContent>
            </Card>
            
            <Card className="bg-white border-muted col-span-1 lg:col-span-2">
              <CardHeader className="pb-1 px-4 pt-3">
                 <CardTitle className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
                   <DollarSign className="h-3 w-3" /> Cotización USD Hoy
                 </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 flex items-center gap-2">
                <div className="relative w-full">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">$</span>
                  <Input 
                    type="number" 
                    value={usdRate}
                    onChange={(e) => setUsdRate(e.target.value)}
                    className="h-9 pl-6 font-bold text-sm bg-muted/20 border-none"
                    placeholder="Ej: 1250"
                  />
                </div>
                <div className="text-[9px] text-muted-foreground leading-tight italic">
                  Usamos este valor para calcular los totales en dólares si no hay saldo fijo USD.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div>
          <div className="flex flex-col sm:flex-row gap-4 mb-4 items-end sm:items-center no-print">
            <Tabs defaultValue="martin" onValueChange={setActiveTab} className="w-full sm:w-auto">
              <TabsList className="grid w-full sm:w-[320px] grid-cols-2 bg-muted/50 p-1">
                <TabsTrigger value="martin" className="font-black uppercase text-[10px] gap-2">
                  <Wallet className="h-3 w-3" /> Fiados Martin
                </TabsTrigger>
                <TabsTrigger value="toti" className="font-black uppercase text-[10px] gap-2">
                  <Filter className="h-3 w-3" /> Arreglos Toti
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-md border w-full sm:w-auto">
               <span className="text-[10px] font-black uppercase px-2 text-muted-foreground">Año de cuenta:</span>
               {[ "2024", "2025", "2026" ].map((year) => (
                 <Button 
                   key={year}
                   variant={activeYear === year ? "default" : "ghost"}
                   size="sm"
                   className={cn("h-7 px-4 text-xs font-bold", activeYear === year && "shadow-sm")}
                   onClick={() => setActiveYear(year)}
                 >
                   {year}
                 </Button>
               ))}
            </div>

            <div className="flex-1"></div>

            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar cliente..." 
                className="pl-9 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
            
          <Card className="shadow-lg border-primary/10 overflow-hidden">
            <CardHeader className="bg-primary/5 py-3 border-b">
               <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                 <Calendar className="h-4 w-4" /> PLANILLA {activeYear} - {activeTab === 'martin' ? 'FIADOS MARTIN' : 'ARREGLOS TOTI'}
               </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground text-sm">Cargando planilla...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/10">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[120px] font-black uppercase text-[10px]">Fecha</TableHead>
                        <TableHead className="font-black uppercase text-[10px]">Cliente</TableHead>
                        <TableHead className="text-right font-black uppercase text-[10px]">Total que le queda</TableHead>
                        <TableHead className="text-right font-black uppercase text-[10px]">USD (Aprox / Fijo)</TableHead>
                        <TableHead className="font-black uppercase text-[10px] min-w-[250px]">Lo que entregó / Notas</TableHead>
                        <TableHead className="text-right no-print font-black uppercase text-[10px]">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((customer) => {
                        const calculatedUSD = (customer.balance || 0) / (parseFloat(usdRate) || 1);
                        const displayUSD = (customer.balanceUSD && customer.balanceUSD > 0) ? customer.balanceUSD : calculatedUSD;
                        
                        return (
                          <TableRow key={customer.id} className="hover:bg-primary/5 transition-colors border-b">
                            <TableCell className="text-[11px] font-medium text-muted-foreground">
                              {customer.updatedAt ? format(new Date(customer.updatedAt), "dd/MM/yyyy", { locale: es }) : "---"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                 <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                   <UserCircle className="h-4 w-4 text-primary" />
                                 </div>
                                 <span className="font-bold text-sm">{customer.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                               <span className={cn("font-black text-base", (customer.balance || 0) > 0 ? "text-red-600" : "text-green-600")}>
                                 ${(customer.balance || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                               </span>
                            </TableCell>
                            <TableCell className="text-right text-xs font-bold text-muted-foreground">
                              USD {displayUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              {(customer.balanceUSD && customer.balanceUSD > 0) && <Badge variant="secondary" className="ml-1 text-[8px] px-1 h-3">FIJO</Badge>}
                            </TableCell>
                            <TableCell>
                              <p className="text-xs text-muted-foreground italic line-clamp-2 max-w-[400px]">
                                {customer.notes || "Sin anotaciones."}
                              </p>
                            </TableCell>
                            <TableCell className="text-right no-print">
                               <div className="flex justify-end gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 w-8 p-0"
                                    onClick={() => handleOpenStatus(customer)}
                                    title="Ver Estado"
                                  >
                                     <FileText className="h-4 w-4 text-primary/60" />
                                  </Button>
                                  <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    className="h-8 px-3 gap-1 text-primary text-[11px] font-bold"
                                    onClick={() => handleOpenPayment(customer)}
                                  >
                                     <Wallet className="h-3.5 w-3.5" /> Cobrar
                                  </Button>
                               </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-20 text-muted-foreground text-sm italic">
                            No hay registros para {activeTab.toUpperCase()} en el año {activeYear}.
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

      <Dialog open={isChargeDialogOpen} onOpenChange={setIsChargeDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="font-headline">Registrar Nuevo Cargo</DialogTitle>
            <DialogDescription>
              Aumentar la deuda de un cliente manualmente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Seleccionar Cliente</Label>
              <Select onValueChange={setChargeCustomerId} value={chargeCustomerId}>
                <SelectTrigger id="customer">
                  <SelectValue placeholder="Buscar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {customers?.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.accountType === 'toti' ? 'Toti' : 'Martin'}) - {c.accountYear || '2025'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Monto de Deuda ($)</Label>
              <Input 
                id="amount" 
                type="number" 
                placeholder="0.00" 
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Lo que entregó / Notas del trato</Label>
              <Textarea 
                id="notes" 
                placeholder="Ej: Se llevó cargador, entregó Samsung..." 
                value={chargeNotes}
                onChange={(e) => setChargeNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChargeDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleProcessCharge} disabled={isSaving || !chargeCustomerId}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Confirmar Cargo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-headline">Registrar Cobro</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
               <span className="text-xs font-bold text-red-800 uppercase">Deuda Actual</span>
               <span className="text-2xl font-black text-red-900">${(selectedCustomer?.balance || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment">Monto que paga ($)</Label>
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

      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl">Estado Detallado</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4 py-4">
              <div className="p-6 rounded-2xl border-2 border-primary/20 bg-primary/5 text-center">
                 <p className="text-xs font-bold uppercase text-primary/60 mb-1">Total que le queda ({selectedCustomer.accountYear || "2025"})</p>
                 <p className={cn("text-4xl font-black font-headline", selectedCustomer.balance > 0 ? "text-red-600" : "text-green-600")}>
                    ${selectedCustomer.balance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                 </p>
                 <p className="text-xs font-bold text-muted-foreground mt-2">
                   Equivale a aprox. USD {((selectedCustomer.balanceUSD && selectedCustomer.balanceUSD > 0) ? selectedCustomer.balanceUSD : (selectedCustomer.balance / (parseFloat(usdRate) || 1))).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                 </p>
              </div>
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
                <p className="text-[10px] font-black uppercase text-amber-700 flex items-center gap-1 mb-2">
                  <Info className="h-3 w-3" /> Lo que entregó / Notas
                </p>
                <div className="text-sm italic text-amber-900 whitespace-pre-wrap">
                  {selectedCustomer.notes || "No hay notas registradas."}
                </div>
              </div>
              <div className="text-xs bg-muted/20 p-3 rounded-lg grid grid-cols-2 gap-2">
                 <div><span className="font-bold">Cliente:</span> {selectedCustomer.name}</div>
                 <div><span className="font-bold">Año:</span> {selectedCustomer.accountYear || '2025'}</div>
                 <div><span className="font-bold">Cartera:</span> {selectedCustomer.accountType?.toUpperCase() || 'MARTIN'}</div>
                 <div><span className="font-bold">Últ. Mov.:</span> {selectedCustomer.updatedAt ? format(new Date(selectedCustomer.updatedAt), "dd/MM/yyyy") : '---'}</div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button className="w-full" variant="outline" onClick={() => window.print()}>Imprimir Ficha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
