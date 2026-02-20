
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
        <div className="print-only p-8 text-black bg-white min-h-screen font-sans">
          <div className="border-[2px] border-black p-0 overflow-hidden rounded-sm relative">
            
            {/* Cabecera AFIP Style */}
            <div className="border-b-[2px] border-black relative">
              {/* Central Box for Invoice Letter */}
              <div className="absolute left-1/2 top-0 -translate-x-1/2 bg-white border-b-[2px] border-x-[2px] border-black w-16 h-16 flex flex-col items-center justify-center z-10">
                <span className="text-5xl font-black leading-none mt-1">
                  {lastSale.invoiceType === 'factura_a' ? 'A' : lastSale.invoiceType === 'factura_b' ? 'B' : 'C'}
                </span>
                <span className="text-[9px] font-bold uppercase mb-1">cod. 01</span>
              </div>

              <div className="grid grid-cols-2 h-36">
                {/* Lado Izquierdo: Datos del Titular */}
                <div className="p-4 flex flex-col justify-center border-r-[1px] border-black/50">
                  <h1 className="text-3xl font-black uppercase leading-tight tracking-tight">{lastSale.billingName || "NOMBRE TITULAR"}</h1>
                  <p className="text-[11px] font-black mt-2">RAZÓN SOCIAL TITULAR</p>
                  <p className="text-[11px]">Dirección Comercial: Av. Principal 1234</p>
                  <p className="text-[11px]">Condición frente al IVA: Responsable Inscripto</p>
                </div>

                {/* Lado Derecho: Datos del Comprobante */}
                <div className="p-4 flex flex-col justify-center pl-14">
                  <h2 className="text-3xl font-black tracking-tighter mb-1">FACTURA</h2>
                  <p className="font-black text-base">Punto de Venta: 0001</p>
                  <p className="font-black text-base">Comp. Nro: 000{lastSale.id.slice(-5)}</p>
                  <p className="font-black text-base">Fecha de Emisión: {new Date(lastSale.date).toLocaleDateString('es-AR')}</p>
                </div>
              </div>

              {/* Barra Intermedia: CUIT / IIBB / Inicio Act */}
              <div className="border-t-[2px] border-black grid grid-cols-2 px-6 py-1 text-[11px] font-bold bg-gray-50">
                <div>CUIT: {lastSale.billingCuit}</div>
                <div className="flex justify-between">
                  <span>Ingresos Brutos: {lastSale.billingCuit}</span>
                  <span>Inicio de Actividades: 01/01/2024</span>
                </div>
              </div>
            </div>

            {/* Datos del Cliente */}
            <div className="border-b-[2px] border-black grid grid-cols-2 bg-white">
              <div className="p-4 border-r-[2px] border-black">
                <p className="text-[10px] uppercase font-black text-gray-500 mb-1">DATOS DEL CLIENTE</p>
                <p className="font-black text-base">{lastSale.customerName}</p>
                <p className="text-sm font-medium">{lastSale.customerAddress}</p>
              </div>
              <div className="p-4">
                <p className="text-[10px] uppercase font-black text-gray-500 mb-1">CONDICIÓN / IDENTIFICACIÓN</p>
                <p className="font-black text-base font-mono">CUIT: {lastSale.customerCuit}</p>
                <p className="text-sm uppercase font-black">IVA: {lastSale.customerId === 'final' ? 'Consumidor Final' : 'RESP. INSCRIPTO'}</p>
              </div>
            </div>

            {/* Tabla de Items */}
            <div className="min-h-[500px]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-[2px] border-black bg-gray-100 text-left font-black uppercase text-[11px]">
                    <th className="p-3 border-r-[2px] border-black w-20 text-center">CANT.</th>
                    <th className="p-3 border-r-[2px] border-black">DESCRIPCIÓN / PRODUCTO</th>
                    <th className="p-3 border-r-[2px] border-black text-right">PRECIO UNIT.</th>
                    <th className="p-3 text-right">SUBTOTAL</th>
                  </tr>
                </thead>
                <tbody className="font-bold">
                  {lastSale.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-300">
                      <td className="p-3 border-r-[2px] border-black text-center text-sm">{item.quantity}</td>
                      <td className="p-3 border-r-[2px] border-black uppercase tracking-tight">{item.productName}</td>
                      <td className="p-3 border-r-[2px] border-black text-right font-mono">${item.price.toFixed(2)}</td>
                      <td className="p-3 text-right font-black font-mono">${item.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                  {/* Espacios en blanco para completar la hoja */}
                  {Array.from({ length: Math.max(0, 12 - lastSale.items.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} className="border-b border-gray-100 h-10">
                      <td className="border-r-[2px] border-black"></td>
                      <td className="border-r-[2px] border-black"></td>
                      <td className="border-r-[2px] border-black"></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pie de Factura con Totales */}
            <div className="border-t-[2px] border-black p-6 flex justify-between items-end bg-gray-50">
              <div className="text-[10px] font-bold space-y-2">
                <p className="uppercase text-gray-600">Observaciones: {lastSale.paymentMethod === 'credit_account' ? 'VENTA A CUENTA CORRIENTE' : 'VENTA CONTADO'}</p>
                <p className="italic">Comprobante generado por TechStore Manager Pro</p>
              </div>
              <div className="w-80 space-y-2">
                <div className="flex justify-between border-b border-black/20 pb-1">
                  <span className="text-[13px] font-bold">Subtotal:</span>
                  <span className="text-[13px] font-black font-mono">${lastSale.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-black/20 pb-1">
                  <span className="text-[13px] font-bold">IVA (21%):</span>
                  <span className="text-[13px] font-black font-mono">${lastSale.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-2xl font-black uppercase tracking-tighter">TOTAL:</span>
                  <span className="text-3xl font-black font-mono tracking-tight">${lastSale.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 flex justify-between items-center text-[9px] font-black uppercase text-gray-400 italic px-2">
            <span>CAE: 74125896321458</span>
            <span>Fecha de Vto. de CAE: {new Date(new Date().getTime() + 864000000).toLocaleDateString('es-AR')}</span>
          </div>
        </div>
      )}
    </div>
  )
}
