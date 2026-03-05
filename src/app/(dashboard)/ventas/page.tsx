
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, Trash2, ShoppingCart, CheckCircle2, Loader2, FileText, CreditCard } from "lucide-react"
import { Product, SaleItem, PaymentMethod, Customer, InvoiceType, Sale, BillingConfig } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, useUser } from "@/firebase"
import { collection, doc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

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
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('factura_b')
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

  const settingsRef = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'settings') : null, 
  [firestore, user])
  const { data: billingConfigs } = useCollection<BillingConfig>(settingsRef)

  useEffect(() => {
    if (billingConfigs && billingConfigs.length > 0 && !selectedBillingCuitId) {
      setSelectedBillingCuitId(billingConfigs[0].id)
    }
  }, [billingConfigs, selectedBillingCuitId])

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
      const displayName = `[${product.code || '----'}] ${product.name}`
      return [...prev, {
        productId: product.id,
        productName: displayName,
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
  const subtotalNet = total / 1.21
  const tax = total - subtotalNet
  const selectedBillingConfig = billingConfigs?.find(b => b.id === selectedBillingCuitId)

  const handleFinishSale = () => {
    if (!user || cart.length === 0) return
    setIsFinishing(true)
    
    const saleId = Math.random().toString(36).substr(2, 9)
    const saleRef = doc(firestore, 'users', user.uid, 'sales', saleId)
    const customer = customers?.find(c => c.id === selectedCustomerId)
    
    const saleData: Sale = {
      id: saleId,
      date: new Date().toISOString(),
      customerId: selectedCustomerId,
      customerName: selectedCustomerId === 'final' || !customer ? 'Consumidor Final' : customer.name,
      customerCuit: customer?.cuit || "Consumidor Final",
      items: JSON.parse(JSON.stringify(cart)),
      subtotal: Number(subtotalNet.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      total: Number(total.toFixed(2)),
      paymentMethod: paymentMethod,
      invoiceType: invoiceType,
      billingCuit: selectedBillingConfig?.cuit || "No definido",
      billingName: selectedBillingConfig?.name || "Tienda Genérica",
      status: 'completed'
    }

    try {
      setDocumentNonBlocking(saleRef, { ...saleData, createdAt: serverTimestamp() }, { merge: true })
      
      cart.forEach(item => {
        const p = products?.find(prod => prod.id === item.productId)
        if (p) {
          const productRef = doc(firestore, 'users', user.uid, 'products', item.productId)
          updateDocumentNonBlocking(productRef, { stock: Math.max(0, p.stock - item.quantity) })
        }
      })

      if (paymentMethod === 'credit_account' && selectedCustomerId !== 'final' && customer) {
        const customerRef = doc(firestore, 'users', user.uid, 'customers', selectedCustomerId)
        updateDocumentNonBlocking(customerRef, { balance: (customer.balance || 0) + total })
      }

      setLastSale({ ...saleData, customerAddress: customer?.address || "Domicilio no registrado" })
      setIsSuccessDialogOpen(true)
      toast({ title: "Venta registrada" })
    } catch (error) {
      console.error("Error al registrar venta:", error)
      toast({ variant: "destructive", title: "Error crítico", description: "No se pudo procesar la transacción." })
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
        <div className="lg:col-span-8 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por código o nombre..." 
                className="pl-9 bg-white" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
          </div>
          <Card className="shadow-sm border-primary/10 overflow-hidden">
            <CardHeader className="bg-muted/30 py-3">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-primary">Catálogo de Productos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isProductsLoading ? (
                <div className="p-12 text-center flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin h-6 w-6 text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">Cargando catálogo...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead className="w-20">Cód.</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-center">Stock</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map(product => (
                      <TableRow key={product.id} className="hover:bg-primary/5">
                        <TableCell className="font-mono text-xs font-bold">{product.code || "----"}</TableCell>
                        <TableCell>
                          <div className="font-bold text-sm">{product.name}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">{product.category}</div>
                        </TableCell>
                        <TableCell className="text-right font-black text-primary">${product.price.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={product.stock < product.minStock ? "destructive" : "outline"} className="font-bold h-5 min-w-[30px] justify-center">
                            {product.stock}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            variant="secondary" 
                            className="h-8 w-8 p-0" 
                            onClick={() => addToCart(product)} 
                            disabled={product.stock <= 0}
                          >
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
              <CardTitle className="text-base flex items-center gap-2 font-headline">
                <ShoppingCart className="h-4 w-4 text-primary" /> Resumen de Venta
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0 scrollbar-thin">
              {cart.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center gap-3">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground opacity-20" />
                  <p className="text-xs text-muted-foreground italic">El carrito está vacío</p>
                </div>
              ) : (
                <Table>
                  <TableBody>
                    {cart.map(item => (
                      <TableRow key={item.productId} className="hover:bg-transparent">
                        <TableCell className="text-[11px] py-3">
                          <div className="font-black uppercase tracking-tighter">{item.productName}</div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-muted-foreground">${item.price.toFixed(2)} x{item.quantity}</span>
                            <span className="font-bold text-primary">${item.subtotal.toFixed(2)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-3 w-10">
                          <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.productId)} className="text-destructive h-7 w-7 p-0 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            <CardFooter className="flex-col border-t bg-muted/20 p-4 space-y-4">
              <div className="w-full space-y-1">
                <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase">
                  <span>Subtotal</span>
                  <span>${subtotalNet.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase">
                  <span>IVA (21%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="w-full flex justify-between items-center pt-1">
                  <span className="text-xs font-black uppercase">Total a Cobrar</span>
                  <span className="text-3xl font-black text-primary font-headline tracking-tighter">${total.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="w-full space-y-2">
                 <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-muted-foreground px-1">Comprobante</label>
                      <Select onValueChange={(v) => setInvoiceType(v as any)} value={invoiceType}>
                        <SelectTrigger className="h-8 text-[10px] font-bold bg-white">
                          <div className="flex items-center gap-1"><FileText className="h-3 w-3" /> <SelectValue /></div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="factura_b">Factura B</SelectItem>
                          <SelectItem value="factura_a">Factura A</SelectItem>
                          <SelectItem value="ticket">Ticket</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-muted-foreground px-1">Medio de Pago</label>
                      <Select onValueChange={(v) => setPaymentMethod(v as any)} value={paymentMethod}>
                        <SelectTrigger className="h-8 text-[10px] font-bold bg-white">
                          <div className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> <SelectValue /></div>
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
                          <SelectItem value="credit_account" disabled={selectedCustomerId === 'final'}>Cta. Corriente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                 </div>

                 <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-muted-foreground px-1">Cliente</label>
                    <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId}>
                      <SelectTrigger className="h-9 text-[10px] font-bold bg-white"><SelectValue placeholder="Seleccionar Cliente" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="final">Consumidor Final</SelectItem>
                        {customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                 </div>

                <Button 
                  className="w-full h-12 text-base font-black uppercase tracking-wide shadow-lg" 
                  disabled={cart.length === 0 || isFinishing} 
                  onClick={handleFinishSale}
                >
                  {isFinishing ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : "Confirmar Venta"}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>

      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="max-w-[400px] text-center p-8">
          <div className="mb-4 flex justify-center">
            <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <h2 className="text-2xl font-black font-headline text-primary mb-2">¡COBRO EXITOSO!</h2>
          <p className="text-muted-foreground text-sm mb-6">La venta se ha registrado y el stock se ha actualizado correctamente.</p>
          <div className="grid grid-cols-2 gap-3">
             <Button variant="outline" className="font-bold">Imprimir Ticket</Button>
             <Button className="font-bold" onClick={resetSale}>Nueva Venta</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
