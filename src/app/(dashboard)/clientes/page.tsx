
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, UserPlus, Phone, Mail, MoreHorizontal, History, Loader2, Save, MapPin, Trash2, Edit2, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { Customer } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export default function CustomersPage() {
  const firestore = useFirestore()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [currentCustomerId, setCurrentCustomerId] = useState<string | null>(null)

  const customersRef = useMemoFirebase(() => collection(firestore, 'customers'), [firestore])
  const { data: customers, isLoading } = useCollection<Customer>(customersRef)

  const [formCustomer, setFormCustomer] = useState<Partial<Customer>>({
    name: "",
    cuit: "",
    email: "",
    phone: "",
    address: "",
    balance: 0
  })

  const filtered = useMemo(() => {
    if (!customers) return []
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
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
      balance: 0
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
      balance: customer.balance
    })
    setIsDialogOpen(true)
  }

  const handleSaveCustomer = () => {
    if (!formCustomer.name || !formCustomer.cuit) {
      toast({
        variant: "destructive",
        title: "Campos obligatorios",
        description: "El nombre y el CUIT son necesarios.",
      })
      return
    }

    setIsSaving(true)
    const customerId = isEditing && currentCustomerId ? currentCustomerId : Math.random().toString(36).substr(2, 9)
    const customerDocRef = doc(firestore, 'customers', customerId)

    const customerData = {
      ...formCustomer,
      id: customerId,
      balance: Number(formCustomer.balance) || 0
    }

    try {
      if (isEditing) {
        updateDocumentNonBlocking(customerDocRef, customerData)
        toast({ title: "Cliente actualizado" })
      } else {
        setDocumentNonBlocking(customerDocRef, customerData, { merge: true })
        toast({ title: "Cliente registrado" })
      }
      setIsDialogOpen(false)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar el cliente.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteCustomer = (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar a ${name}?`)) {
      const docRef = doc(firestore, 'customers', id)
      deleteDocumentNonBlocking(docRef)
      toast({ title: "Cliente eliminado" })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold font-headline text-primary">Directorio de Clientes</h1>
          <p className="text-muted-foreground">Gestiona la información y contacto de tus clientes.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={handleOpenAdd}>
              <UserPlus className="h-4 w-4" /> Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
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
                  placeholder="Ej: Juan Pérez" 
                  value={formCustomer.name}
                  onChange={(e) => setFormCustomer({...formCustomer, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cuit">CUIT / CUIL</Label>
                <Input 
                  id="cuit" 
                  placeholder="Ej: 20-12345678-9" 
                  value={formCustomer.cuit}
                  onChange={(e) => setFormCustomer({...formCustomer, cuit: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input 
                    id="phone" 
                    placeholder="Ej: 11 1234 5678" 
                    value={formCustomer.phone}
                    onChange={(e) => setFormCustomer({...formCustomer, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="balance">Saldo Inicial</Label>
                  <Input 
                    id="balance" 
                    type="number"
                    placeholder="0.00" 
                    value={formCustomer.balance}
                    onChange={(e) => setFormCustomer({...formCustomer, balance: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input 
                  id="email" 
                  type="email"
                  placeholder="ejemplo@correo.com" 
                  value={formCustomer.email}
                  onChange={(e) => setFormCustomer({...formCustomer, email: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Dirección (Opcional)</Label>
                <Input 
                  id="address" 
                  placeholder="Ej: Av. Rivadavia 1234" 
                  value={formCustomer.address}
                  onChange={(e) => setFormCustomer({...formCustomer, address: e.target.value})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
              <Button onClick={handleSaveCustomer} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar Cliente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nombre, CUIT, email o teléfono..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Cargando clientes...</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((customer) => (
              <Card key={customer.id} className="overflow-hidden hover:shadow-md transition-shadow border-primary/10">
                <CardHeader className="pb-2 flex flex-row items-center gap-4 space-y-0">
                  <Avatar className="h-12 w-12 border bg-primary/10">
                    <AvatarFallback className="text-primary font-bold">
                      {customer.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{customer.name}</CardTitle>
                    <p className="text-xs text-muted-foreground font-bold tracking-wider">CUIT: {customer.cuit || "No registrado"}</p>
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
                      <DropdownMenuItem onClick={() => handleDeleteCustomer(customer.id, customer.name)} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span className="truncate">{customer.cuit || "Sin CUIT"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{customer.email || "Sin email"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{customer.phone || "Sin teléfono"}</span>
                    </div>
                    {customer.address && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="truncate">{customer.address}</span>
                      </div>
                    )}
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
                      <History className="h-4 w-4" /> Historial
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground bg-white rounded-xl border border-dashed">
            No se encontraron clientes registrados.
          </div>
        )}
      </div>
    </div>
  )
}
