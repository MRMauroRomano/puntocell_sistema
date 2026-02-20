
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, Trash2, ShoppingCart, CheckCircle2, FileCheck, Loader2, Printer, X } from "lucide-react"
import { Product, SaleItem, PaymentMethod, Customer, InvoiceType, Sale, BillingConfig } from "@/lib/types"
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
  const [selectedBillingCuitId, setSelectedBillingCuitId] = useState<string>("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('factura_b')
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false)
  const [isFinishing, setIsFinishing] = useState(false)
  const [lastSale, setLastSale] = useState<(Sale & { customerAddress?: string }) | null>(null)

  const productsRef = useMemoFirebase(() => collection(firestore, 'products'), [firestore])
  const { data: products, isLoading: isProductsLoading } = useCollection<Product>(productsRef)

  const customersRef = useMemoFirebase(() => collection(firestore, 'customers'), [firestore])
  const { data: customers } = useCollection<Customer>(customersRef)

  const settingsRef = useMemoFirebase(() => collection(firestore, 'settings'), [firestore])
  const { data: billingConfigs, isLoading: isSettingsLoading } = useCollection<BillingConfig>(settingsRef)

  useEffect(() => {
    if (billingConfigs && billingConfigs.length > 0 && !selectedBillingCuitId) {
      setSelectedBillingCuitId(billingConfigs[0].id)
    }
  }, [billingConfigs, selectedBillingCuitId])

  const categories = useMemo(() => {
    if (!products) return ["all"]
    return ["all", ...Array.from(new Set(products.map(p => p.category)))]
  }, [products])

  const filteredProducts = useMemo(() => {
    if (!products) return []
    return products.filter(p => {
      const matchesSearch = (
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.subCategory && p.subCategory.toLowerCase().includes(searchTerm.toLowerCase()))
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
      const displayName = `${product.name} (${product.condition})`
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
    if (cart.length === 0) return
    setIsFinishing(true)
    const saleId = Math.random().toString(36).substr(2, 9)
    const saleRef = doc(firestore, 'sales', saleId)
    const customer = customers?.find(c => c.id === selectedCustomerId)
    
    const saleData: Sale = {
      id: saleId,
      date: new Date().toISOString(),
      customerId: selectedCustomerId || 'final',
      customerName: selectedCustomerId === 'final' || !customer ? 'Consumidor Final' : customer.name,
      customerCuit: customer?.cuit || "Consumidor Final",
      items: [...cart],
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
        const p = products?.find(prod => prod.id === item.productId)
        if (p) {
          const productRef = doc(firestore, 'products', item.productId)
          updateDocumentNonBlocking(productRef, { stock: Math.max(0, p.stock - item.quantity) })
        }
      })
      if (paymentMethod === 'credit_account' && selectedCustomerId && selectedCustomerId !== 'final' && customer) {
        updateDocumentNonBlocking(doc(firestore, 'customers', selectedCustomerId), { balance: (customer.balance || 0) + total })
      }
      setLastSale({ ...saleData, customerAddress: customer?.address || "Domicilio no registrado" })
      setIsSuccessDialogOpen(true)
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar la venta." })
    } finally {
      setIsFinishing(false)
    }
  }

  const handlePrint = () => { if (typeof window !== 'undefined') window.print() }
  const resetSale = () => { setCart([]); setSelectedCustomerId(null); setIsSuccessDialogOpen(false); setLastSale(null); }

  return (
    <div className="relative">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-12rem)] no-print">
        <div className="lg:col-span-7 space-y-4 flex flex-col">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nombre o marca..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.filter(c => c !== 'all').map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          <Card className="flex-1 overflow-hidden flex flex-col shadow-sm border-primary/10">
            <CardHeader className="bg-muted/30 py-3"><CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Catálogo</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-auto max-h-[400px] lg:max-h-full">
              {isProductsLoading ? <div className="p-10 text-center"><Loader2 className="animate-spin inline mr-2" />Cargando...</div> : (
                <Table>
                  <TableHeader className="bg-muted/10 sticky top-0 z-10">
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map(product => (
                      <TableRow key={product.id} className="hover:bg-primary/5 transition-colors">
                        <TableCell>
                          <div className="font-bold text-sm">{product.name}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">{product.subCategory}</div>
                        </TableCell>
                        <TableCell><Badge variant={product.condition === 'Nuevo' ? 'default' : 'secondary'} className="text-[9px]">{product.condition}</Badge></TableCell>
                        <TableCell className="font-bold text-primary">${product.price.toFixed(2)}</TableCell>
                        <TableCell><Badge variant={product.stock < product.minStock ? "destructive" : "outline"} className="text-[10px]">{product.stock}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-primary hover:text-white" onClick={() => addToCart(product)} disabled={product.stock <= 0}>
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

        <div className="lg:col-span-5 flex flex-col gap-4">
          <Card className="flex-1 flex flex-col overflow-hidden border-primary/20 bg-white shadow-lg">
            <CardHeader className="py-4 border-b bg-primary/5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 font-headline"><ShoppingCart className="h-5 w-5 text-primary" /> Carrito</CardTitle>
                <Badge variant="secondary" className="font-bold">{cart.length} items</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0 max-h-[300px] lg:max-h-full">
              {cart.length === 0 ? <div className="p-10 text-center text-muted-foreground text-sm">Carrito vacío</div> : (
                <Table>
                  <TableBody>
                    {cart.map(item => (
                      <TableRow key={item.productId}>
                        <TableCell className="text-xs font-medium">{item.productName}</TableCell>
                        <TableCell className="text-center text-xs">x{item.quantity}</TableCell>
                        <TableCell className="text-right text-xs font-bold">${item.subtotal.toFixed(2)}</TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => removeFromCart(item.productId)} className="text-destructive h-7 w-7 p-0"><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            <CardFooter className="flex-col border-t bg-muted/20 p-4 lg:p-6 space-y-4">
              <div className="w-full flex justify-between items-center py-2">
                <span className="text-base font-bold">TOTAL:</span>
                <span className="text-2xl font-black text-primary font-headline">${total.toFixed(2)}</span>
              </div>
              <div className="w-full space-y-3 pt-2">
                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Emisor:</label>
                      <Select onValueChange={setSelectedBillingCuitId} value={selectedBillingCuitId}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                        <SelectContent>{billingConfigs?.map(b => <SelectItem key={b.id} value={b.id}>{b.name.split(' ')[0]}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Factura:</label>
                      <Select onValueChange={(v) => setInvoiceType(v as any)} value={invoiceType}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="factura_a">Factura A</SelectItem><SelectItem value="factura_b">Factura B</SelectItem><SelectItem value="ticket">Ticket</SelectItem></SelectContent>
                      </Select>
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Cliente:</label>
                      <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId || ""}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Final" /></SelectTrigger>
                        <SelectContent><SelectItem value="final">Consumidor Final</SelectItem>{customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Pago:</label>
                      <Select onValueChange={(v) => setPaymentMethod(v as any)} value={paymentMethod}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="cash">Efectivo</SelectItem><SelectItem value="debit">Débito</SelectItem><SelectItem value="credit_account" disabled={!selectedCustomerId || selectedCustomerId === 'final'}>Cta Cte</SelectItem></SelectContent>
                      </Select>
                    </div>
                 </div>
                <Button className="w-full h-12 font-bold uppercase" disabled={cart.length === 0 || isFinishing} onClick={handleFinishSale}>
                  {isFinishing ? <Loader2 className="animate-spin" /> : <><CheckCircle2 className="mr-2" /> Confirmar Venta</>}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>

      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[425px] no-print rounded-xl">
          <DialogHeader className="items-center text-center">
            <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center mb-2"><CheckCircle2 className="h-8 w-8 text-green-600" /></div>
            <DialogTitle className="text-xl font-bold">¡Venta Exitosa!</DialogTitle>
          </DialogHeader>
          <div className="bg-muted/30 p-4 rounded-xl text-center"><span className="text-2xl font-black text-green-700">${total.toFixed(2)}</span></div>
          <DialogFooter className="flex flex-col gap-2">
            <Button className="w-full" variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Imprimir Factura</Button>
            <Button className="w-full" variant="ghost" onClick={resetSale}>Nueva Venta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {lastSale && (
        <div className="print-only p-4 text-black bg-white min-h-screen">
          <div className="border-[2px] border-black p-4 space-y-4">
            <div className="grid grid-cols-2 border-b-[2px] border-black pb-4">
              <div><h1 className="text-2xl font-black uppercase">{lastSale.billingName}</h1><p>CUIT: {lastSale.billingCuit}</p></div>
              <div className="text-right"><h2 className="text-xl font-black uppercase">FACTURA {lastSale.invoiceType === 'factura_a' ? 'A' : 'B'}</h2><p>Fecha: {new Date(lastSale.date).toLocaleDateString()}</p></div>
            </div>
            <div className="py-2 border-b-[2px] border-black"><p className="uppercase font-bold">Cliente: {lastSale.customerName}</p><p>CUIT: {lastSale.customerCuit}</p></div>
            <table className="w-full">
              <thead><tr className="border-b-[2px] border-black text-left"><th>Cant.</th><th>Descripción</th><th className="text-right">Precio</th><th className="text-right">Total</th></tr></thead>
              <tbody>{lastSale.items.map((item, idx) => (<tr key={idx} className="border-b"><td>{item.quantity}</td><td className="uppercase">{item.productName}</td><td className="text-right">${item.price.toFixed(2)}</td><td className="text-right font-bold">${item.subtotal.toFixed(2)}</td></tr>))}</tbody>
            </table>
            <div className="text-right pt-4 border-t-[2px] border-black"><p className="text-2xl font-black">TOTAL: ${lastSale.total.toFixed(2)}</p></div>
          </div>
        </div>
      )}
    </div>
  )
}
