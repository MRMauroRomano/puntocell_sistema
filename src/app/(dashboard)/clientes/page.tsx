"use client"

import { useState, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, UserPlus, Phone, Mail, MoreHorizontal, History, Loader2, Save, Trash2, Edit2, FileUp, Layers, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useUser } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { Customer } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import * as XLSX from 'xlsx'

export default function CustomersPage() {
  const firestore = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [currentCustomerId, setCurrentCustomerId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [bulkData, setBulkData] = useState({
    accountType: 'martin',
    accountYear: '2025'
  })

  const customersRef = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'customers') : null, 
  [firestore, user])
  const { data: customers, isLoading } = useCollection<Customer>(customersRef)

  const [formCustomer, setFormCustomer] = useState<Partial<Customer>>({
    name: "",
    cuit: "",
    email: "",
    phone: "",
    address: "",
    balance: 0,
    accountType: "martin",
    accountYear: "2025",
    notes: ""
  })

  const filtered = useMemo(() => {
    if (!customers) return []
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.phone && c.phone.includes(searchTerm)) ||
      (c.cuit && c.cuit.includes(searchTerm))
    )
  }, [customers, searchTerm])

  const handleOpenAdd = () => {
    setIsEditing(false)
    setCurrentCustomerId(null)
    setFormCustomer({
      name: "",
      cuit: "",
      email: "",
      phone: "",
      address: "",
      balance: 0,
      accountType: "martin",
      accountYear: new Date().getFullYear().toString(),
      notes: ""
    })
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (customer: Customer) => {
    setIsEditing(true)
    setCurrentCustomerId(customer.id)
    setFormCustomer({
      name: customer.name,
      cuit: customer.cuit || "",
      email: customer.email,
      phone: customer.phone,
      address: customer.address || "",
      balance: customer.balance,
      accountType: customer.accountType || "martin",
      accountYear: customer.accountYear || "2025",
      notes: customer.notes || ""
    })
    setIsDialogOpen(true)
  }

  const handleSaveCustomer = () => {
    if (!user || !formCustomer.name) {
      toast({
        variant: "destructive",
        title: "Campos obligatorios",
        description: "El nombre es necesario.",
      })
      return
    }

    setIsSaving(true)
    const customerId = isEditing && currentCustomerId ? currentCustomerId : Math.random().toString(36).substr(2, 9)
    const customerDocRef = doc(firestore, 'users', user.uid, 'customers', customerId)

    const customerData = {
      ...formCustomer,
      id: customerId,
      balance: Number(formCustomer.balance) || 0,
      accountType: formCustomer.accountType || "martin",
      accountYear: formCustomer.accountYear || "2025",
      notes: formCustomer.notes || "",
      updatedAt: new Date().toISOString()
    }

    try {
      if (isEditing) {
        updateDocumentNonBlocking(customerDocRef, customerData)
        toast({ title: "Cliente actualizado" })
      } else {
        setDocumentNonBlocking(customerDocRef, { ...customerData, createdAt: new Date().toISOString() }, { merge: true })
        toast({ title: "Cliente registrado" })
      }
      setIsDialogOpen(false)
    } catch (error) {
      // Handled centrally
    } finally {
      setIsSaving(false)
    }
  }

  const handleBulkUpdate = () => {
    if (!user || selectedIds.length === 0) return
    setIsSaving(true)
    try {
      selectedIds.forEach(id => {
        const docRef = doc(firestore, 'users', user.uid, 'customers', id)
        updateDocumentNonBlocking(docRef, {
          accountType: bulkData.accountType,
          accountYear: bulkData.accountYear,
          updatedAt: new Date().toISOString()
        })
      })
      toast({ 
        title: "Actualización masiva completada", 
        description: `Se modificaron ${selectedIds.length} clientes.` 
      })
      setIsBulkDialogOpen(false)
      setSelectedIds([])
    } catch (error) {
      // Handled centrally
    } finally {
      setIsSaving(false)
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filtered.map(c => c.id))
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleDeleteCustomer = (id: string) => {
    if (!user) return
    const docRef = doc(firestore, 'users', user.uid, 'customers', id)
    deleteDocumentNonBlocking(docRef)
    toast({ title: "Cliente eliminado" })
  }

  const handleClearAllCustomers = () => {
    if (!user || !customers || customers.length === 0) return
    
    customers.forEach(customer => {
      const docRef = doc(firestore, 'users', user.uid, 'customers', customer.id)
      deleteDocumentNonBlocking(docRef)
    })
    
    toast({
      title: "Directorio vaciado",
      description: "Todos los clientes de tu tienda han sido eliminados.",
    })
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
            const finalBalance = parseFloat(String(normalized.deuda || normalized.saldo || normalized.debe || normalized.total || normalized.quedaba || "0").replace(/[^0-9.-]+/g, "")) || 0
            const delivery = parseFloat(String(normalized.entrega || normalized.pago || "0").replace(/[^0-9.-]+/g, "")) || 0
            
            // PROCESAR FECHA DEL EXCEL (DETECCIÓN FLEXIBLE INCLUYENDO "FECHAS")
            let importedDate = new Date().toISOString()
            const rawDateVal = normalized.fechas || normalized.fecha || normalized.date || normalized.dia
            
            if (rawDateVal) {
              if (typeof rawDateVal === 'number') {
                const d = new Date((rawDateVal - 25569) * 86400 * 1000)
                if (!isNaN(d.getTime())) importedDate = d.toISOString()
              } else {
                const dateStr = String(rawDateVal).trim()
                const parts = dateStr.split(/[/.-]/) // Soporta /, . o -
                if (parts.length === 3) {
                  const day = parseInt(parts[0], 10)
                  const month = parseInt(parts[1], 10) - 1
                  let year = parseInt(parts[2], 10)
                  
                  // Manejar formato AA (aa) convirtiéndolo a AAAA
                  if (parts[2].length === 2) {
                    year = 2000 + year
                  }
                  
                  const d = new Date(year, month, day)
                  if (!isNaN(d.getTime())) importedDate = d.toISOString()
                } else {
                  const d = new Date(rawDateVal)
                  if (!isNaN(d.getTime())) importedDate = d.toISOString()
                }
              }
            }

            const product = String(normalized.producto || normalized.equipo || "")
            const rawNotes = String(normalized.notas || normalized.observaciones || normalized.loqueentrego || normalized.entrego || "")
            const formattedDateStr = new Date(importedDate).toLocaleDateString('es-AR')

            let historyNotes = ""
            if (product && product !== "undefined" && product !== "") historyNotes += `Producto: ${product}\n`
            if (delivery > 0) historyNotes += `[${formattedDateStr}] Entrega previa: $${delivery.toFixed(2)}\n`
            if (rawNotes && rawNotes !== "undefined" && rawNotes !== "") historyNotes += `Nota: ${rawNotes}`

            const rawType = String(normalized.cartera || normalized.tipo || normalized.cuenta || "martin").toLowerCase()
            const accountType = rawType.includes('toti') ? 'toti' : 'martin'
            const accountYear = String(normalized.anio || normalized.year || normalized.periodo || "2025")

            const customerData = {
              id,
              name: String(name),
              balance: finalBalance,
              notes: historyNotes,
              accountType,
              accountYear,
              createdAt: importedDate,
              updatedAt: importedDate,
              email: normalized.email || "",
              phone: String(normalized.telefono || normalized.phone || ""),
              cuit: String(normalized.cuit || "")
            }
            
            const customerRef = doc(firestore, 'users', user.uid, 'customers', id)
            setDocumentNonBlocking(customerRef, customerData, { merge: true })
            importedCount++
          }
        })
        
        toast({ 
          title: "Importación completa", 
          description: `Se procesaron ${importedCount} clientes respetando sus fechas originales.` 
        })
      } catch (err) {
        toast({ variant: "destructive", title: "Error al importar Excel" })
      } finally {
        setIsImporting(false)
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold font-headline text-primary">Mis Clientes</h1>
          <p className="text-muted-foreground">Directorio exclusivo de tu negocio.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button 
            variant="secondary"
            className={cn("gap-2 flex-1 sm:flex-none bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200", selectedIds.length === 0 && "opacity-50 pointer-events-none")} 
            onClick={() => setIsBulkDialogOpen(true)}
          >
            <Layers className="h-4 w-4" /> Modificación Masiva ({selectedIds.length})
          </Button>

          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleImportExcel} 
            accept=".xlsx, .xls" 
          />
          <Button 
            variant="outline" 
            className="gap-2 flex-1 sm:flex-none" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            Importar Excel
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                className="gap-2 flex-1 sm:flex-none" 
                disabled={!customers || customers.length === 0}
              >
                <Trash2 className="h-4 w-4" /> Vaciar Directorio
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Borrar todos tus clientes?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción eliminará a TODOS los clientes de TU tienda. Las deudas volverán a $0.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearAllCustomers} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Confirmar y Vaciar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 flex-1 sm:flex-none" onClick={handleOpenAdd}>
                <UserPlus className="h-4 w-4" /> Nuevo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-headline">
                  {isEditing ? "Editar Cliente" : "Registrar Cliente"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input 
                    id="name" 
                    value={formCustomer.name}
                    onChange={(e) => setFormCustomer({...formCustomer, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="accountType">Tipo de Cuenta</Label>
                    <Select 
                      value={formCustomer.accountType} 
                      onValueChange={(v) => setFormCustomer({...formCustomer, accountType: v as any})}
                    >
                      <SelectTrigger id="accountType">
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="martin">Fiados Martin</SelectItem>
                        <SelectItem value="toti">Arreglos Toti</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountYear">Año de Cuenta</Label>
                    <Select 
                      value={formCustomer.accountYear} 
                      onValueChange={(v) => setFormCustomer({...formCustomer, accountYear: v})}
                    >
                      <SelectTrigger id="accountYear">
                        <SelectValue placeholder="Seleccionar año" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2024">2024</SelectItem>
                        <SelectItem value="2025">2025</SelectItem>
                        <SelectItem value="2026">2026</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cuit">CUIT / CUIL (Opcional)</Label>
                  <Input 
                    id="cuit" 
                    value={formCustomer.cuit}
                    onChange={(e) => setFormCustomer({...formCustomer, cuit: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input 
                      id="phone" 
                      value={formCustomer.phone}
                      onChange={(e) => setFormCustomer({...formCustomer, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="balance">Saldo Actual ($)</Label>
                    <Input 
                      id="balance" 
                      type="number"
                      value={formCustomer.balance}
                      onChange={(e) => setFormCustomer({...formCustomer, balance: Number(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo</Label>
                  <Input 
                    id="email" 
                    type="email"
                    value={formCustomer.email}
                    onChange={(e) => setFormCustomer({...formCustomer, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Lo que entregó / Historial de Entregas</Label>
                  <Textarea 
                    id="notes" 
                    placeholder="Ej: [10/03/2026] Entregó Samsung J7 como parte de pago..." 
                    className="min-h-[120px]"
                    value={formCustomer.notes}
                    onChange={(e) => setFormCustomer({...formCustomer, notes: e.target.value})}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
                <Button onClick={handleSaveCustomer} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Guardar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar en mi directorio..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg border">
            <Checkbox 
              id="select-all" 
              checked={filtered.length > 0 && selectedIds.length === filtered.length}
              onCheckedChange={toggleSelectAll}
            />
            <Label htmlFor="select-all" className="text-xs font-bold cursor-pointer uppercase">Seleccionar Todos</Label>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Sincronizando tus clientes...</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((customer) => (
              <Card 
                key={customer.id} 
                className={cn(
                  "overflow-hidden transition-all border-primary/10",
                  selectedIds.includes(customer.id) ? "ring-2 ring-primary bg-primary/5" : "hover:shadow-md"
                )}
              >
                <CardHeader className="pb-2 flex flex-row items-center gap-3 space-y-0">
                  <div className="shrink-0">
                    <Checkbox 
                      checked={selectedIds.includes(customer.id)}
                      onCheckedChange={() => handleToggleSelect(customer.id)}
                    />
                  </div>
                  <Avatar className="h-10 w-10 border bg-primary/10">
                    <AvatarFallback className="text-primary font-bold text-xs">
                      {customer.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm truncate">{customer.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[8px] uppercase font-black px-1 h-4">
                        {customer.accountType === 'toti' ? 'Toti' : 'Martin'}
                      </Badge>
                      <Badge variant="outline" className="text-[8px] px-1 h-4">{customer.accountYear || "2025"}</Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenEdit(customer)}>
                        <Edit2 className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { if(confirm("¿Eliminar cliente?")) handleDeleteCustomer(customer.id) }} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="space-y-3 pt-3">
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5 truncate">
                      <Phone className="h-3 w-3" />
                      <span className="truncate">{customer.phone || "---"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{customer.email || "---"}</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase font-bold text-muted-foreground">Deuda</span>
                      <span className={cn("text-base font-black", customer.balance > 0 ? "text-red-600" : "text-green-600")}>
                        ${customer.balance.toFixed(2)}
                      </span>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 text-xs font-bold gap-1" onClick={() => handleOpenEdit(customer)}>
                      <History className="h-3.5 w-3.5" /> Ficha
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-amber-600" /> Modificación Masiva
            </DialogTitle>
            <DialogDescription>
              Estás modificando <strong>{selectedIds.length}</strong> clientes seleccionados.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Asignar Cartera</Label>
              <Select 
                value={bulkData.accountType} 
                onValueChange={(v) => setBulkData({...bulkData, accountType: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="martin">Fiados Martin</SelectItem>
                  <SelectItem value="toti">Arreglos Toti</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Asignar Año de Cuenta</Label>
              <Select 
                value={bulkData.accountYear} 
                onValueChange={(v) => setBulkData({...bulkData, accountYear: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button 
              onClick={handleBulkUpdate} 
              disabled={isSaving} 
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Aplicar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
