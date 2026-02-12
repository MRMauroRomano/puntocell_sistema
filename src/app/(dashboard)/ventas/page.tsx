
"use client"

import { useState, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, Trash2, ShoppingCart, CreditCard, DollarSign, Printer, CheckCircle2, FileCheck, Tag, Loader2, FileText } from "lucide-react"
import { MOCK_BILLING_CONFIGS } from "@/lib/mock-data"
import { Product, SaleItem, PaymentMethod, Customer, InvoiceType, Sale } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase"
import { collection, doc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function SalesPage() {
  const firestore = useFirestore()
  const { toast } = useToast()
  const [cart, setCart] = useState<SaleItem[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [selectedBillingCuitId, setSelectedBillingCuitId] = useState<string>(MOCK_BILLING_CONFIGS[0].id)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('factura_b')
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false)
  const [isFinishing, setIsFinishing] = useState(false)
  const [lastSale, setLastSale] = useState<Sale | null>(null)

  // Fetch products from Firestore
  const productsRef = useMemoFirebase(() => collection(firestore, 'products'), [firestore])
  const { data: products, isLoading: isProductsLoading } = useCollection<Product>(productsRef)

  // Fetch customers from Firestore
  const customersRef = useMemoFirebase(() => collection(firestore, 'customers'), [firestore])
  const { data: customers } = useCollection<Customer>(customersRef)

  const categories = useMemo(() => {
    if (!products) return ["all"]
    return ["all", ...Array.from(new Set(products.map(p => p.category)))]
  }, [products])

  const filteredProducts = useMemo(() => {
    if (!products) return []
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
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
      return [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        price: product.price,
        subtotal: product.price
      }]
    })
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.productId !== id))
  }

  const subtotalNet = cart.reduce((acc, curr) => acc + curr.subtotal, 0)
  const tax = subtotalNet * 0.21
  const total = subtotalNet + tax

  const selectedBillingConfig = MOCK_BILLING_CONFIGS.find(b => b.id === selectedBillingCuitId)

  const handleFinishSale = () => {
    if (cart.length === 0) return
    
    setIsFinishing(true)
    const saleId = Math.random().toString(36).substr(2, 9)
    const saleRef = doc(firestore, 'sales', saleId)
    
    const customer = customers?.find(c => c.id === selectedCustomerId)
    const customerName = selectedCustomerId === 'final' || !customer ? 'Consumidor Final' : customer.name
    const customerCuit = customer?.cuit || ""

    const saleData: Sale = {
      id: saleId,
      date: new Date().toISOString(),
      customerId: selectedCustomerId || 'final',
      customerName: customerName,
      customerCuit: customerCuit,
      items: cart,
      subtotal: subtotalNet,
      tax: tax,
      total: total,
      paymentMethod,
      invoiceType,
      billingCuit: selectedBillingConfig?.cuit,
      billingName: selectedBillingConfig?.name,
    }

    try {
      setDocumentNonBlocking(saleRef, { ...saleData, createdAt: serverTimestamp() }, { merge: true })
      
      cart.forEach(item => {
        const product = products?.find(p => p.id === item.productId)
        if (product) {
          const productRef = doc(firestore, 'products', item.productId)
          updateDocumentNonBlocking(productRef, {
            stock: Math.max(0, product.stock - item.quantity)
          })
        }
      })

      if (paymentMethod === 'credit_account' && selectedCustomerId && selectedCustomerId !== 'final' && customer) {
        const customerDocRef = doc(firestore, 'customers', selectedCustomerId)
        updateDocumentNonBlocking(customerDocRef, {
          balance: (customer.balance || 0) + total
        })
      }

      setLastSale(saleData)
      toast({
        title: "Venta Registrada",
        description: `Se generó la ${getInvoiceLabel(invoiceType)} correctamente.`,
      })
      
      setIsSuccessDialogOpen(true)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: "No se pudo registrar la venta.",
      })
    } finally {
      setIsFinishing(false)
    }
  }

  const resetSale = () => {
    setCart([])
    setSelectedCustomerId(null)
    setPaymentMethod('cash')
    setIsSuccessDialogOpen(false)
    setLastSale(null)
  }

  const getInvoiceLabel = (type: InvoiceType) => {
    switch(type) {
      case 'factura_a': return 'Factura A';
      case 'factura_b': return 'Factura B';
      case 'ticket': return 'Ticket';
      default: return type;
    }
  }

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    switch(method) {
      case 'cash': return 'Efectivo';
      case 'debit': return 'Débito';
      case 'credit_card': return 'Tarjeta de Crédito';
      case 'transfer': return 'Transferencia';
      case 'credit_account': return 'Cuenta Corriente';
      default: return method;
    }
  }

  return (
    <div className="relative">
      {/* UI Content - Hidden during print */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-12rem)] no-print">
        {/* Product Selection */}
        <div className="lg:col-span-7 space-y-4 flex flex-col">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nombre o marca..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat === "all" ? "Todas" : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Card className="flex-1 overflow-hidden flex flex-col">
            <CardHeader className="bg-muted/30 py-3">
              <CardTitle className="text-sm">Productos Disponibles</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-auto">
              {isProductsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground">Cargando productos...</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/10 sticky top-0 z-10">
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Marca/Subcat</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map(product => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{product.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Tag className="h-3 w-3" /> {product.subCategory || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="font-bold">${product.price.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={product.stock < product.minStock ? "destructive" : "secondary"} className="text-[10px]">
                            {product.stock}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => addToCart(product)} disabled={product.stock <= 0}>
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

        {/* Cart and Checkout */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <Card className="flex-1 flex flex-col overflow-hidden border-primary/20 bg-white/50 backdrop-blur-sm">
            <CardHeader className="py-4 border-b bg-primary/5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" /> Carrito
                </CardTitle>
                <Badge variant="outline" className="text-xs">{cart.length} items</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                  <ShoppingCart className="h-12 w-12 mb-2 opacity-20" />
                  <p>El carrito está vacío</p>
                  <p className="text-xs">Selecciona productos a la izquierda para empezar.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Cant.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map(item => (
                      <TableRow key={item.productId}>
                        <TableCell className="max-w-[150px] truncate">{item.productName}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell className="text-right">${item.subtotal.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.productId)} className="text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            <CardFooter className="flex-col border-t bg-muted/20 p-6 space-y-4">
              <div className="w-full space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal Neto:</span>
                  <span className="font-medium">${subtotalNet.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IVA (21%):</span>
                  <span className="font-medium">${tax.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center pt-2">
                  <span className="text-lg font-bold">Total:</span>
                  <span className="text-2xl font-bold text-primary font-headline">${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="w-full space-y-3 pt-4 border-t">
                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Tipo Comprobante:</label>
                      <Select onValueChange={(v) => setInvoiceType(v as any)} value={invoiceType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="factura_a">Factura A</SelectItem>
                          <SelectItem value="factura_b">Factura B</SelectItem>
                          <SelectItem value="ticket">Ticket Fiscal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Medio de Pago</label>
                      <Select onValueChange={(v) => setPaymentMethod(v as any)} value={paymentMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Efectivo</SelectItem>
                          <SelectItem value="debit">Débito</SelectItem>
                          <SelectItem value="credit_card">Crédito</SelectItem>
                          <SelectItem value="transfer">Transferencia</SelectItem>
                          <SelectItem value="credit_account" disabled={!selectedCustomerId || selectedCustomerId === 'final'}>Cuenta Cte.</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                 </div>

                 <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Cliente (Obligatorio para Factura A)</label>
                    <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId || ""}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar Cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="final">Consumidor Final</SelectItem>
                        {customers?.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name} (CUIT: {c.cuit})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                 </div>
                
                <Button 
                  className="w-full h-12 text-lg font-bold gap-2" 
                  size="lg" 
                  disabled={cart.length === 0 || isFinishing || (invoiceType === 'factura_a' && (!selectedCustomerId || selectedCustomerId === 'final'))}
                  onClick={handleFinishSale}
                >
                  {isFinishing ? <Loader2 className="h-5 w-5 animate-spin" /> : "Finalizar Venta"}
                </Button>
                {invoiceType === 'factura_a' && (!selectedCustomerId || selectedCustomerId === 'final') && (
                  <p className="text-[10px] text-destructive text-center font-bold">Para Factura A se requiere un cliente registrado con CUIT.</p>
                )}
              </div>
            </CardFooter>
          </Card>
        </div>

        <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader className="items-center text-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-2">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <DialogTitle className="text-2xl font-headline">¡Venta Exitosa!</DialogTitle>
              <DialogDescription>
                La transacción se ha registrado correctamente en el sistema.
              </DialogDescription>
            </DialogHeader>
            <div className="bg-muted/30 p-4 rounded-lg space-y-2 my-4">
               <div className="flex justify-between">
                  <span className="text-sm">Total Cobrado:</span>
                  <span className="text-sm font-bold">${total.toFixed(2)}</span>
               </div>
               <div className="flex justify-between">
                  <span className="text-sm">Comprobante:</span>
                  <span className="text-sm font-bold uppercase">{getInvoiceLabel(invoiceType)}</span>
               </div>
               <div className="flex justify-between pt-2 border-t border-muted-foreground/20">
                  <span className="text-xs flex items-center gap-1"><FileCheck className="h-3 w-3" /> Facturado por:</span>
                  <span className="text-xs font-medium">{selectedBillingConfig?.name}</span>
               </div>
            </div>
            <DialogFooter className="flex-col sm:flex-col gap-2">
              <Button className="w-full gap-2" variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Imprimir Comprobante
              </Button>
              <Button className="w-full" onClick={resetSale}>Nueva Venta</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Invoice Template - Print Only */}
      {lastSale && (
        <div className="print-only p-8 text-black bg-white min-h-screen">
          <div className="border-2 border-black p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-black pb-4">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold uppercase">{lastSale.billingName || "TechStore Pro"}</h1>
                <p className="text-sm">Responsable Inscripto</p>
                <p className="text-xs">Av. Rivadavia 1234, CABA</p>
                <p className="text-xs font-bold">CUIT: {lastSale.billingCuit}</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="border-2 border-black w-16 h-16 flex items-center justify-center text-4xl font-black mb-1">
                  {lastSale.invoiceType === 'factura_a' ? 'A' : 'B'}
                </div>
                <p className="text-[10px] font-bold">COD. 01</p>
              </div>
              <div className="text-right space-y-1">
                <h2 className="text-xl font-bold uppercase">{getInvoiceLabel(lastSale.invoiceType)}</h2>
                <p className="text-sm font-bold">N° 0001-00000{Math.floor(Math.random() * 1000)}</p>
                <p className="text-sm">Fecha: {new Date(lastSale.date).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-4 text-sm border-b-2 border-black pb-4">
              <div className="space-y-1">
                <p><span className="font-bold">Señor(es):</span> {lastSale.customerName}</p>
                <p><span className="font-bold">Domicilio:</span> Calle Falsa 123</p>
              </div>
              <div className="space-y-1">
                <p><span className="font-bold">CUIT:</span> {lastSale.customerCuit || "20-00000000-1"}</p>
                <p><span className="font-bold">Cond. IVA:</span> {lastSale.invoiceType === 'factura_a' ? 'Responsable Inscripto' : 'Consumidor Final'}</p>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="text-left py-2">Cant.</th>
                  <th className="text-left py-2">Descripción</th>
                  <th className="text-right py-2">Precio Unit.</th>
                  <th className="text-right py-2">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lastSale.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2">{item.quantity}</td>
                    <td className="py-2">{item.productName}</td>
                    <td className="py-2 text-right">${item.price.toFixed(2)}</td>
                    <td className="py-2 text-right">${item.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="border-t-2 border-black pt-4 flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal Neto:</span>
                  <span>${lastSale.subtotal.toFixed(2)}</span>
                </div>
                {lastSale.invoiceType === 'factura_a' && (
                  <div className="flex justify-between text-sm">
                    <span>IVA (21.00%):</span>
                    <span>${lastSale.tax.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold border-t border-black pt-2">
                  <span>TOTAL:</span>
                  <span>${lastSale.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-12 flex justify-between items-end">
               <div className="text-[10px] italic">
                 Comprobante generado por CommerceManager Pro.
               </div>
               <div className="text-right space-y-1">
                  <p className="text-xs font-bold uppercase">CAI N°: 12345678901234</p>
                  <p className="text-xs font-bold uppercase">VTO. CAI: 31/12/2024</p>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
