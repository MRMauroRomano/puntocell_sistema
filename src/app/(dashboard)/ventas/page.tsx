
"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, Trash2, ShoppingCart, CheckCircle2, Loader2, Printer } from "lucide-react"
import { Product, SaleItem, PaymentMethod, Customer, InvoiceType, Sale, BillingConfig } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
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

  const categories = useMemo(() => {
    if (!products) return ["all"]
    return ["all", ...Array.from(new Set(products.map(p => p.category)))]
  }, [products])

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
      items: [...cart],
      subtotal: subtotalNet,
      tax: tax,
      total: total,
      paymentMethod,
      invoiceType,
      billingCuit: selectedBillingConfig?.cuit,
      billingName: selectedBillingConfig?.name,
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
        updateDocumentNonBlocking(doc(firestore, 'users', user.uid, 'customers', selectedCustomerId), { balance: (customer.balance || 0) + total })
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
  const resetSale = () => { setCart([]); setSelectedCustomerId('final'); setIsSuccessDialogOpen(false); setLastSale(null); }

  return (
    <div className="relative">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        <div className="lg:col-span-8 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por código o nombre..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <Card className="shadow-sm border-primary/10 overflow-hidden">
            <CardHeader className="bg-muted/30 py-3"><CardTitle className="text-xs font-bold uppercase">Mis Productos Disponibles</CardTitle></CardHeader>
            <CardContent className="p-0">
              {isProductsLoading ? <div className="p-10 text-center"><Loader2 className="animate-spin" /></div> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cód.</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead className="text-right">Añadir</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map(product => (
                      <TableRow key={product.id}>
                        <TableCell className="font-mono text-xs">{product.code}</TableCell>
                        <TableCell>
                          <div className="font-bold text-sm">{product.name}</div>
                          <div className="text-[10px] text-muted-foreground">{product.category}</div>
                        </TableCell>
                        <TableCell className="font-bold text-primary">${product.price.toFixed(2)}</TableCell>
                        <TableCell><Badge variant={product.stock < product.minStock ? "destructive" : "outline"}>{product.stock}</Badge></TableCell>
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

        <div className="lg:col-span-4">
          <Card className="sticky top-6 border-primary/20 bg-white shadow-lg flex flex-col max-h-[calc(100vh-8rem)]">
            <CardHeader className="py-3 border-b bg-primary/5">
              <CardTitle className="text-base flex items-center gap-2 font-headline"><ShoppingCart className="h-4 w-4 text-primary" /> Carrito de Venta</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              {cart.length === 0 ? <div className="p-8 text-center text-xs italic">Vacío</div> : (
                <Table>
                  <TableBody>
                    {cart.map(item => (
                      <TableRow key={item.productId}>
                        <TableCell className="text-[11px] py-2">
                          <div className="font-bold">{item.productName}</div>
                          <div>${item.price.toFixed(2)} x{item.quantity}</div>
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.productId)} className="text-destructive h-6 w-6 p-0">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            <CardFooter className="flex-col border-t bg-muted/20 p-4 space-y-3">
              <div className="w-full flex justify-between items-center">
                <span className="text-xs font-black">TOTAL:</span>
                <span className="text-2xl font-black text-primary font-headline">${total.toFixed(2)}</span>
              </div>
              <div className="w-full space-y-2">
                 <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId}>
                   <SelectTrigger className="h-8 text-[10px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="final">Consumidor Final</SelectItem>
                     {customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                   </SelectContent>
                 </Select>
                 <Select onValueChange={(v) => setPaymentMethod(v as any)} value={paymentMethod}>
                   <SelectTrigger className="h-8 text-[10px]"><SelectValue placeholder="Pago" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="cash">Efectivo</SelectItem>
                     <SelectItem value="credit_account" disabled={selectedCustomerId === 'final'}>Cuenta Corriente</SelectItem>
                   </SelectContent>
                 </Select>
                <Button className="w-full" disabled={cart.length === 0 || isFinishing} onClick={handleFinishSale}>
                  {isFinishing ? <Loader2 className="animate-spin" /> : "Finalizar Cobro"}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>

      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="max-w-[400px]">
          <div className="text-center py-4">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
            <DialogTitle className="text-xl font-bold">¡Venta Exitosa!</DialogTitle>
          </div>
          <Button className="w-full" onClick={resetSale}>Cerrar y Nueva Venta</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
