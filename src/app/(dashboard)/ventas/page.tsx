
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, Trash2, ShoppingCart, CheckCircle2, Loader2, FileText, LayoutGrid, ChevronRight, Tag, Wallet, UserCircle } from "lucide-react"
import { Product, SaleItem, PaymentMethod, Customer, InvoiceType, Sale, BillingConfig, AccountMovement } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, useUser } from "@/firebase"
import { collection, doc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

const CATEGORIES = ["Celulares", "Fundas", "Audio", "Accesorios", "Computación", "Repuestos", "Otros"]

export default function SalesPage() {
  const firestore = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  const [cart, setCart] = useState<SaleItem[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("final")
  const [selectedBillingCuitId, setSelectedBillingCuitId] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('ticket')
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false)
  const [isFinishing, setIsFinishing] = useState(false)
  const [lastSale, setLastSale] = useState<(Sale & { customerAddress?: string }) | null>(null)

  const productsRef = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'products') : null, 
  [firestore, user])
  const { data: products, isLoading: isProductsLoading } = useCollection<Product>(productsRef)

  const customersRef = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'customers') : null, 
  [firestore, user])
  const { data: customers } = useCollection<Customer>(customersRef)

  const billingConfigsRef = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'settings') : null, 
  [firestore, user])
  const { data: billingConfigs } = useCollection<BillingConfig>(billingConfigsRef)

  useEffect(() => {
    if (billingConfigs && billingConfigs.length > 0 && !selectedBillingCuitId) {
      setSelectedBillingCuitId(billingConfigs[0].id)
    }
  }, [billingConfigs, selectedBillingCuitId])

  // Automatización: Si selecciona un cliente real, forzar Cuenta Corriente
  useEffect(() => {
    if (selectedCustomerId !== 'final') {
      setPaymentMethod('credit_account')
    } else {
      setPaymentMethod('cash')
    }
  }, [selectedCustomerId])

  const filteredProducts = useMemo(() => {
    if (!products) return []
    return products.filter(p => {
      const search = searchTerm.toLowerCase()
      const matchesSearch = (
        p.name.toLowerCase().includes(search) || 
        (p.subCategory && p.subCategory.toLowerCase().includes(search)) ||
        (p.code && p.code.includes(search))
      )
      const matchesCategory = selectedCategory === "all" || p.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [products, searchTerm, selectedCategory])

  const categoryCounts = useMemo(() => {
    if (!products) return {}
    const counts: Record<string, number> = { all: products.length }
    products.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1
    })
    return counts
  }, [products])

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id)
      if (existing) {
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
            : item
        )
      }
      return [...prev, {
        productId: product.id,
        productName: `[${product.code}] ${product.name}`,
        quantity: 1,
        price: product.price,
        subtotal: product.price
      }]
    })
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.productId !== id))
  }

  const total = cart.reduce((acc, curr) => acc + curr.subtotal, 0)
  const selectedBillingConfig = billingConfigs?.find(b => b.id === selectedBillingCuitId)

  const handleFinishSale = () => {
    if (!user || cart.length === 0) return
    setIsFinishing(true)
    
    const saleId = Math.random().toString(36).substr(2, 9).toUpperCase()
    const saleRef = doc(firestore, 'users', user.uid, 'sales', saleId)
    const customer = customers?.find(c => c.id === selectedCustomerId)
    
    // El método de pago se decide por la lógica del efecto anterior
    const saleData: Sale = {
      id: saleId,
      date: new Date().toISOString(),
      customerId: selectedCustomerId,
      customerName: selectedCustomerId === 'final' || !customer ? 'Consumidor Final' : customer.name,
      customerCuit: customer?.cuit || "Consumidor Final",
      items: JSON.parse(JSON.stringify(cart)),
      subtotal: total,
      tax: 0,
      total: total,
      paymentMethod: paymentMethod,
      invoiceType: invoiceType,
      billingCuit: selectedBillingConfig?.cuit || "No definido",
      billingName: selectedBillingConfig?.name || "Tienda",
      status: 'completed'
    }

    try {
      setDocumentNonBlocking(saleRef, { ...saleData, createdAt: serverTimestamp() }, { merge: true })
      
      cart.forEach(item => {
        const p = products?.find(prod => prod.id === item.productId)
        if (p) {
          const productRef = doc(firestore, 'users', user.uid, 'products', item.productId)
          updateDocumentNonBlocking(productRef, { stock: p.stock - item.quantity })
        }
      })

      // Guardado crítico en Cuenta Corriente
      if (paymentMethod === 'credit_account' && selectedCustomerId !== 'final' && customer) {
        const customerRef = doc(firestore, 'users', user.uid, 'customers', selectedCustomerId)
        
        // 1. Crear el movimiento detallado para el Libro de Cuentas (cobro por ítem)
        const movementId = Math.random().toString(36).substr(2, 9)
        const movementRef = doc(firestore, 'users', user.uid, 'customers', selectedCustomerId, 'movements', movementId)
        const itemsStr = cart.map(i => `${i.quantity}x ${i.productName}`).join(", ")
        
        const movementData: AccountMovement = {
          id: movementId,
          date: new Date().toISOString(),
          description: `VENTA POS: ${itemsStr}`,
          amount: total,
          type: 'charge',
          status: 'pending',
          referenceId: saleId
        }
        setDocumentNonBlocking(movementRef, movementData, { merge: true })

        // 2. Actualizar el saldo global del cliente y su historial visual
        const timestamp = format(new Date(), "dd/MM/yyyy")
        const newNote = `[${timestamp}] COMPRA FIADA: +$${total.toLocaleString('es-AR')} - ${itemsStr}\n`
        const updatedNotes = newNote + (customer.notes || "")

        updateDocumentNonBlocking(customerRef, { 
          balance: (customer.balance || 0) + total,
          notes: updatedNotes,
          updatedAt: new Date().toISOString()
        })
      }

      setLastSale({ ...saleData, customerAddress: customer?.address || "" })
      setIsSuccessDialogOpen(true)
      toast({ title: "Operación completada" })
    } catch (error) {
      toast({ variant: "destructive", title: "Error al registrar la venta" })
    } finally {
      setIsFinishing(false)
    }
  }

  const resetSale = () => {
    setCart([])
    setSelectedCustomerId('final')
    setIsSuccessDialogOpen(false)
    setLastSale(null)
  }

  return (
    <div className="relative">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-primary/10 shadow-sm sticky top-6">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-2">
                <Tag className="h-4 w-4" /> Categorías
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <nav className="flex flex-col gap-1">
                <Button 
                  variant={selectedCategory === 'all' ? 'secondary' : 'ghost'} 
                  className={cn("justify-between font-bold h-10 px-3 text-xs", selectedCategory === 'all' && "bg-primary/10 text-primary")}
                  onClick={() => setSelectedCategory('all')}
                >
                  <div className="flex items-center gap-2"><LayoutGrid className="h-4 w-4" /><span>Todos</span></div>
                  <Badge variant="outline" className="h-5 min-w-5 justify-center bg-white">{categoryCounts.all || 0}</Badge>
                </Button>
                {CATEGORIES.map(cat => (
                  <Button 
                    key={cat}
                    variant={selectedCategory === cat ? 'secondary' : 'ghost'} 
                    className={cn("justify-between font-medium h-10 px-3 text-xs", selectedCategory === cat && "bg-primary/10 text-primary")}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    <div className="flex items-center gap-2"><ChevronRight className="h-3 w-3" /><span>{cat}</span></div>
                    <Badge variant="outline" className="h-5 min-w-5 justify-center bg-white">{categoryCounts[cat] || 0}</Badge>
                  </Button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Escribir nombre o código de producto..." 
              className="pl-9 bg-white h-11 shadow-sm" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          
          <Card className="shadow-sm border-primary/10 overflow-hidden">
            <CardContent className="p-0">
              {isProductsLoading ? (
                <div className="p-12 text-center flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin h-6 w-6 text-primary" />
                  <p className="text-xs text-muted-foreground">Sincronizando inventario...</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead className="w-16">Cód.</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map(product => (
                      <TableRow key={product.id} className="hover:bg-primary/5">
                        <TableCell className="font-mono text-[10px] font-bold">{product.code}</TableCell>
                        <TableCell>
                          <div className="font-bold text-sm">{product.name}</div>
                          <div className="text-[9px] text-muted-foreground uppercase">{product.category} {product.storage && `• ${product.storage}`}</div>
                        </TableCell>
                        <TableCell className="text-right font-black text-primary">${product.price.toLocaleString('es-AR')}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="secondary" className="h-8 w-8 p-0 shadow-sm" onClick={() => addToCart(product)} disabled={product.stock <= 0}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4">
          <Card className="sticky top-6 border-primary/20 bg-white shadow-xl flex flex-col max-h-[calc(100vh-8rem)]">
            <CardHeader className="py-3 border-b bg-primary/5">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" /> Detalle de Cobro
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center gap-2">
                   <ShoppingCart className="h-10 w-10 text-muted-foreground opacity-20" />
                   <p className="text-xs text-muted-foreground italic">Carrito de ventas vacío</p>
                </div>
              ) : (
                <Table>
                  <TableBody>
                    {cart.map(item => (
                      <TableRow key={item.productId} className="border-b last:border-none">
                        <TableCell className="text-[10px] py-3">
                          <div className="font-black text-xs truncate max-w-[180px]">{item.productName}</div>
                          <div className="flex justify-between mt-1">
                            <span className="text-muted-foreground">${item.price.toLocaleString('es-AR')} x{item.quantity}</span>
                            <span className="font-bold text-primary">${item.subtotal.toLocaleString('es-AR')}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-3">
                          <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.productId)} className="text-destructive h-8 w-8 p-0 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            <CardFooter className="flex-col border-t bg-muted/20 p-5 space-y-5">
              <div className="w-full flex justify-between items-center">
                <span className="text-xs font-black uppercase text-muted-foreground">Monto Final</span>
                <span className="text-3xl font-black text-primary font-headline tracking-tighter">${total.toLocaleString('es-AR')}</span>
              </div>
              
              <div className="w-full space-y-3">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
                      <UserCircle className="h-3 w-3" /> Asignar a Cliente
                    </label>
                    <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId}>
                      <SelectTrigger className="h-11 text-xs font-bold bg-white border-primary/20">
                        <SelectValue placeholder="Consumidor Final" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="final">Consumidor Final (Contado)</SelectItem>
                        {customers?.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.accountType === 'toti' ? 'Toti' : 'Martin'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                 </div>

                 {selectedCustomerId === 'final' ? (
                   <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-muted-foreground">Medio de Pago</label>
                        <Select onValueChange={(v) => setPaymentMethod(v as any)} value={paymentMethod}>
                          <SelectTrigger className="h-10 text-[10px] font-bold bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Efectivo</SelectItem>
                            <SelectItem value="transfer">Transferencia</SelectItem>
                            <SelectItem value="visa">Visa / Débito</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-muted-foreground">Comprobante</label>
                        <Select onValueChange={(v) => setInvoiceType(v as any)} value={invoiceType}>
                          <SelectTrigger className="h-10 text-[10px] font-bold bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ticket">Ticket X</SelectItem>
                            <SelectItem value="factura_b">Factura B</SelectItem>
                            <SelectItem value="factura_a">Factura A</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                   </div>
                 ) : (
                   <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
                     <Wallet className="h-5 w-5 text-amber-600" />
                     <div>
                       <p className="text-[10px] font-black uppercase text-amber-700">Modo Fiado Activo</p>
                       <p className="text-[9px] text-amber-600 leading-tight">La venta se guardará automáticamente en la Cuenta Corriente del cliente.</p>
                     </div>
                   </div>
                 )}

                <Button 
                  className="w-full h-14 text-sm font-black uppercase tracking-widest shadow-lg gap-2" 
                  disabled={cart.length === 0 || isFinishing} 
                  onClick={handleFinishSale}
                >
                  {isFinishing ? <Loader2 className="animate-spin h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                  Confirmar Operación
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>

      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="max-w-[400px] text-center p-8">
          <DialogHeader>
            <div className="mb-4 flex justify-center">
              <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center border-4 border-green-50 shadow-sm">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
            </div>
            <DialogTitle className="text-2xl font-black font-headline text-primary mb-2 uppercase tracking-tight text-center">
              ¡Operación Exitosa!
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm mb-6 text-center">
              {selectedCustomerId === 'final' 
                ? 'La venta ha sido registrada y el stock actualizado.'
                : 'La deuda ha sido cargada correctamente a la cuenta del cliente.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
             <Button variant="outline" className="font-bold border-2" onClick={() => window.print()}>Imprimir Comprobante</Button>
             <Button className="font-bold shadow-md" onClick={resetSale}>Nueva Operación</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
