
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Wrench, CheckCircle2, Loader2, UserCircle, CreditCard, FileText, Info } from "lucide-react"
import { Customer, PaymentMethod, InvoiceType, Sale, BillingConfig } from "@/lib/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, useUser } from "@/firebase"
import { collection, doc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function ArreglosPage() {
  const firestore = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  
  // Estados del Formulario
  const [productName, setProductName] = useState("")
  const [price, setPrice] = useState("")
  const [notes, setNotes] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("final")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
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
    if (!user || !productName || total <= 0) {
      toast({
        variant: "destructive",
        title: "Campos incompletos",
        description: "Por favor indica el producto y el precio del arreglo."
      })
      return
    }

    setIsFinishing(true)
    const saleId = `REPAIR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    const saleRef = doc(firestore, 'users', user.uid, 'sales', saleId)
    const customer = customers?.find(c => c.id === selectedCustomerId)
    
    const saleData: Sale = {
      id: saleId,
      date: new Date().toISOString(),
      customerId: selectedCustomerId,
      customerName: selectedCustomerId === 'final' || !customer ? 'Consumidor Final' : customer.name,
      customerCuit: customer?.cuit || "Consumidor Final",
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
      paymentMethod: paymentMethod,
      invoiceType: invoiceType,
      billingCuit: selectedBillingConfig?.cuit || "No definido",
      billingName: selectedBillingConfig?.name || "Tienda de Arreglos",
      status: 'completed'
    }

    try {
      // Guardar la venta (el arreglo es una venta de servicio)
      setDocumentNonBlocking(saleRef, { ...saleData, createdAt: serverTimestamp(), repairNotes: notes }, { merge: true })
      
      // Si es cuenta corriente, actualizar saldo del cliente
      if (paymentMethod === 'credit_account' && selectedCustomerId !== 'final' && customer) {
        const customerRef = doc(firestore, 'users', user.uid, 'customers', selectedCustomerId)
        // Por defecto, los arreglos suelen ir a la cartera de "Toti"
        updateDocumentNonBlocking(customerRef, { 
          balance: (customer.balance || 0) + total,
          accountType: customer.accountType || 'toti' 
        })
      }

      setIsSuccessDialogOpen(true)
      toast({ title: "Arreglo registrado con éxito" })
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar el arreglo." })
    } finally {
      setIsFinishing(false)
    }
  }

  const resetForm = () => {
    setProductName("")
    setPrice("")
    setNotes("")
    setSelectedCustomerId('final')
    setIsSuccessDialogOpen(false)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold font-headline text-primary flex items-center gap-2">
          <Wrench className="h-8 w-8" /> Carga de Arreglos
        </h1>
        <p className="text-muted-foreground text-sm">Registra reparaciones y servicios técnicos fuera de inventario.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Formulario de Arreglo */}
        <Card className="lg:col-span-7 border-primary/20 shadow-md">
          <CardHeader className="bg-primary/5 border-b py-4">
            <CardTitle className="text-base font-headline">Detalles del Servicio</CardTitle>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-xs font-black uppercase text-muted-foreground">Precio del Arreglo ($)</Label>
                  <Input 
                    id="price" 
                    type="number"
                    placeholder="0.00" 
                    className="h-11 font-black text-primary text-xl"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-muted-foreground">Medio de Cobro</Label>
                  <Select onValueChange={(v) => setPaymentMethod(v as any)} value={paymentMethod}>
                    <SelectTrigger className="h-11 font-bold">
                      <div className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> <SelectValue /></div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Efectivo</SelectItem>
                      <SelectItem value="transfer">Transferencia</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="visa">Tarjeta Visa</SelectItem>
                      <SelectItem value="mastercard">Mastercard</SelectItem>
                      <SelectItem value="cabal">Cabal</SelectItem>
                      <SelectItem value="premier">Premier</SelectItem>
                      <SelectItem value="paselibre">Pase Libre</SelectItem>
                      <SelectItem value="debit">Débito</SelectItem>
                      <SelectItem value="credit_account" disabled={selectedCustomerId === 'final'}>Cuenta Corriente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-xs font-black uppercase text-muted-foreground">Nota / Detalles de la Reparación</Label>
                <Textarea 
                  id="notes" 
                  placeholder="Ej: Se cambió pin de carga y se realizó limpieza de placa. Garantía 30 días." 
                  className="min-h-[120px] bg-muted/20"
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
                <UserCircle className="h-4 w-4" /> Cliente y Facturación
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Seleccionar Cliente</Label>
                  <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId}>
                    <SelectTrigger className="h-10 font-bold">
                      <SelectValue placeholder="Consumidor Final" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="final">Consumidor Final</SelectItem>
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
                  {selectedCustomerId !== 'final' && (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 flex items-start gap-2">
                      <Info className="h-4 w-4 text-amber-600 mt-0.5" />
                      <p className="text-[10px] text-amber-800 leading-tight">
                        Si seleccionas <strong>Cuenta Corriente</strong>, el saldo se sumará automáticamente a la deuda del cliente en la cartera correspondiente.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Tipo de Comprobante</Label>
                  <Select onValueChange={(v) => setInvoiceType(v as any)} value={invoiceType}>
                    <SelectTrigger className="h-10 font-bold">
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

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm font-black uppercase">Total a Pagar</span>
                  <span className="text-3xl font-black text-primary font-headline tracking-tighter">${total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-6 pt-0">
              <Button 
                className="w-full h-12 text-base font-black uppercase tracking-wide shadow-lg gap-2" 
                disabled={!productName || total <= 0 || isFinishing}
                onClick={handleFinishRepair}
              >
                {isFinishing ? <Loader2 className="animate-spin h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                Confirmar Arreglo
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="max-w-[400px] text-center p-8">
          <div className="mb-4 flex justify-center">
            <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center border-4 border-green-50 shadow-sm">
              <Wrench className="h-10 w-10 text-green-600" />
            </div>
          </div>
          <h2 className="text-2xl font-black font-headline text-primary mb-1 uppercase tracking-tight">Servicio Registrado</h2>
          <p className="text-muted-foreground text-sm mb-6">El comprobante de arreglo ha sido emitido y guardado en el historial.</p>
          <div className="grid grid-cols-2 gap-3">
             <Button variant="outline" className="font-bold border-2">Imprimir Ticket</Button>
             <Button className="font-bold shadow-md" onClick={resetForm}>Nuevo Arreglo</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
