
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Wrench, CheckCircle2, Loader2, UserCircle, FileText, Info } from "lucide-react"
import { Customer, PaymentMethod, InvoiceType, Sale, BillingConfig, AccountMovement } from "@/lib/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, useUser } from "@/firebase"
import { collection, doc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"

export default function ArreglosPage() {
  const firestore = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  
  // Estados del Formulario
  const [productName, setProductName] = useState("")
  const [price, setPrice] = useState("")
  const [notes, setNotes] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("")
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('ticket')
  const [selectedBillingCuitId, setSelectedBillingCuitId] = useState<string>("")
  
  // Estados de UI
  const [isFinishing, setIsFinishing] = useState(false)
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false)

  const customersRef = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'customers') : null, 
  [firestore, user])
  const { data: customers } = useCollection<Customer>(customersRef)

  const settingsRef = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'settings') : null, 
  [firestore, user])
  const { data: billingConfigs } = useCollection<BillingConfig>(settingsRef)

  useEffect(() => {
    if (billingConfigs && billingConfigs.length > 0 && !selectedBillingCuitId) {
      setSelectedBillingCuitId(billingConfigs[0].id)
    }
  }, [billingConfigs, selectedBillingCuitId])

  const total = Number(price) || 0
  const selectedBillingConfig = billingConfigs?.find(b => b.id === selectedBillingCuitId)

  const handleFinishRepair = () => {
    if (!user || !productName || total <= 0 || !selectedCustomerId) {
      toast({
        variant: "destructive",
        title: "Campos incompletos",
        description: "Por favor selecciona un cliente, el producto y el precio."
      })
      return
    }

    setIsFinishing(true)
    const saleId = `REPAIR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    const saleRef = doc(firestore, 'users', user.uid, 'sales', saleId)
    const customer = customers?.find(c => c.id === selectedCustomerId)
    
    // Siempre a Cuenta Corriente para clientes registrados
    const finalPaymentMethod: PaymentMethod = 'credit_account'
    
    const saleData: Sale = {
      id: saleId,
      date: new Date().toISOString(),
      customerId: selectedCustomerId,
      customerName: customer?.name || 'Cliente',
      customerCuit: customer?.cuit || "---",
      items: [
        {
          productId: 'service_repair',
          productName: `Arreglo: ${productName}`,
          quantity: 1,
          price: total,
          subtotal: total
        }
      ],
      subtotal: Number(total.toFixed(2)),
      tax: 0,
      total: Number(total.toFixed(2)),
      paymentMethod: finalPaymentMethod,
      invoiceType: invoiceType,
      billingCuit: selectedBillingConfig?.cuit || "No definido",
      billingName: selectedBillingConfig?.name || "Tienda de Arreglos",
      status: 'completed'
    }

    try {
      // Guardar la venta
      setDocumentNonBlocking(saleRef, { ...saleData, createdAt: serverTimestamp(), repairNotes: notes }, { merge: true })
      
      // 1. Crear el movimiento detallado para cobro individual
      const movementId = Math.random().toString(36).substr(2, 9)
      const movementRef = doc(firestore, 'users', user.uid, 'customers', selectedCustomerId, 'movements', movementId)
      
      const movementData: AccountMovement = {
        id: movementId,
        date: new Date().toISOString(),
        description: `ARREGLO: ${productName}`,
        amount: total,
        type: 'charge',
        status: 'pending',
        referenceId: saleId
      }
      setDocumentNonBlocking(movementRef, movementData, { merge: true })

      // 2. Actualizar su saldo y historial visual
      if (customer) {
        const customerRef = doc(firestore, 'users', user.uid, 'customers', selectedCustomerId)
        
        const timestamp = format(new Date(), "dd/MM/yyyy")
        const newNote = `[${timestamp}] ARREGLO FIADO: +$${total.toLocaleString('es-AR')} - ${productName}${notes ? ` (${notes})` : ''}\n`
        const updatedNotes = newNote + (customer.notes || "")

        updateDocumentNonBlocking(customerRef, { 
          balance: (customer.balance || 0) + total,
          notes: updatedNotes,
          updatedAt: new Date().toISOString()
        })

        toast({
          title: "Saldo actualizado",
          description: `Se sumaron $${total} a la cuenta corriente de ${customer.name}.`
        })
      }

      setIsSuccessDialogOpen(true)
      toast({ title: "Arreglo registrado con éxito" })
    } catch (error) {
      // Handled centrally
    } finally {
      setIsFinishing(false)
    }
  }

  const resetForm = () => {
    setProductName("")
    setPrice("")
    setNotes("")
    setSelectedCustomerId("")
    setIsSuccessDialogOpen(false)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold font-headline text-primary flex items-center gap-2">
          <Wrench className="h-8 w-8" /> Arreglos y Servicios
        </h1>
        <p className="text-muted-foreground text-sm">Registro directo a Cuenta Corriente del cliente con historial automático.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Formulario de Arreglo */}
        <Card className="lg:col-span-7 border-primary/20 shadow-md">
          <CardHeader className="bg-primary/5 border-b py-4">
            <CardTitle className="text-base font-headline">Detalles del Servicio Técnico</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product" className="text-xs font-black uppercase text-muted-foreground">Producto / Equipo a Reparar</Label>
                <Input 
                  id="product" 
                  placeholder="Ej: Samsung A51 - Cambio de Módulo" 
                  className="font-bold h-12 text-lg"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price" className="text-xs font-black uppercase text-muted-foreground">Precio del Arreglo ($)</Label>
                <Input 
                  id="price" 
                  type="number"
                  placeholder="0.00" 
                  className="h-12 font-black text-primary text-2xl"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-xs font-black uppercase text-muted-foreground">Nota / Detalles de la Reparación</Label>
                <Textarea 
                  id="notes" 
                  placeholder="Ej: Se cambió pin de carga y se realizó limpieza de placa. Garantía 30 días." 
                  className="min-h-[150px] bg-muted/20"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Panel de Confirmación */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-primary/20 shadow-xl bg-white sticky top-6">
            <CardHeader className="py-4 border-b bg-muted/30">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-primary flex items-center gap-2">
                <UserCircle className="h-4 w-4" /> Asignación de Cuenta
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Seleccionar Cliente</Label>
                  <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId}>
                    <SelectTrigger className="h-11 font-bold">
                      <SelectValue placeholder="Elegir cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          <div className="flex justify-between items-center w-full gap-2">
                            <span>{c.name}</span>
                            <span className="text-[10px] opacity-50">{c.accountType === 'toti' ? '(Toti)' : '(Martin)'}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 flex items-start gap-3">
                  <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-primary">Libro de Cuentas</p>
                    <p className="text-xs text-muted-foreground leading-tight mt-1">
                      El sistema registrará automáticamente: **Fecha**, **Equipo** y **Monto** en la ficha histórica del cliente.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Tipo de Comprobante</Label>
                  <Select onValueChange={(v) => setInvoiceType(v as any)} value={invoiceType}>
                    <SelectTrigger className="h-11 font-bold">
                      <div className="flex items-center gap-2"><FileText className="h-4 w-4" /> <SelectValue /></div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ticket">Ticket de Arreglo</SelectItem>
                      <SelectItem value="factura_b">Factura B</SelectItem>
                      <SelectItem value="factura_a">Factura A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-black uppercase text-muted-foreground">Total a Cargar</span>
                  <span className="text-4xl font-black text-primary font-headline tracking-tighter">${total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-6 pt-0">
              <Button 
                className="w-full h-14 text-lg font-black uppercase tracking-wide shadow-lg gap-2" 
                disabled={!productName || total <= 0 || isFinishing || !selectedCustomerId}
                onClick={handleFinishRepair}
              >
                {isFinishing ? <Loader2 className="animate-spin h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
                Confirmar y Anotar
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="max-w-[400px] text-center p-8">
          <DialogHeader>
            <div className="mb-4 flex justify-center">
              <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center border-4 border-green-50 shadow-sm">
                <Wrench className="h-10 w-10 text-green-600" />
              </div>
            </div>
            <DialogTitle className="text-2xl font-black font-headline text-primary mb-1 uppercase tracking-tight text-center">
              Anotado con Éxito
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm mb-6 text-center">
              La reparación ha sido cargada al historial y saldo del cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
             <Button variant="outline" className="font-bold border-2" onClick={() => window.print()}>Imprimir Ticket</Button>
             <Button className="font-bold shadow-md" onClick={resetForm}>Nuevo Arreglo</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
