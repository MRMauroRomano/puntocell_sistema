
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, Trash2, ShoppingCart, CheckCircle2, FileCheck, Loader2, Printer, X } from "lucide-react"
import { MOCK_BILLING_CONFIGS } from "@/lib/mock-data"
import { Product, SaleItem, PaymentMethod, Customer, InvoiceType, Sale } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase"
import { collection, doc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

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
  const [lastSale, setLastSale] = useState<(Sale & { customerAddress?: string }) | null>(null)

  const productsRef = useMemoFirebase(() => collection(firestore, 'products'), [firestore])
  const { data: products, isLoading: isProductsLoading } = useCollection<Product>(productsRef)

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
    const customerCuit = customer?.cuit || "Consumidor Final"
    const customerAddress = customer?.address || "Domicilio no registrado"

    const saleData: Sale = {
      id: saleId,
      date: new Date().toISOString(),
      customerId: selectedCustomerId || 'final',
      customerName: customerName,
      customerCuit: customerCuit,
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

      setLastSale({ ...saleData, customerAddress })
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

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
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

  return (
    <div className="relative">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-12rem)] no-print">
        <div className="lg:col-span-7 space-y-4 flex flex-col">
          <div className="flex flex-col sm:flex-row gap-2">
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
              <SelectTrigger className="w-full sm:w-[180px]">
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
          
          <Card className="flex-1 overflow-hidden flex flex-col shadow-sm border-primary/10">
            <CardHeader className="bg-muted/30 py-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Catálogo de Productos</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-auto max-h-[400px] lg:max-h-full">
              {isProductsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground text-sm">Cargando inventario...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/10 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="min-w-[150px]">Producto</TableHead>
                        <TableHead>Marca</TableHead>
                        <TableHead>Precio</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map(product => (
                        <TableRow key={product.id} className="hover:bg-primary/5 transition-colors">
                          <TableCell className="font-medium text-sm">{product.name}</TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">{product.subCategory || "-"}</span>
                          </TableCell>
                          <TableCell className="font-bold text-primary text-sm">${product.price.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={product.stock < product.minStock ? "destructive" : "secondary"} className="text-[10px]">
                              {product.stock}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-primary hover:text-white" onClick={() => addToCart(product)} disabled={product.stock <= 0}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-4">
          <Card className="flex-1 flex flex-col overflow-hidden border-primary/20 bg-white shadow-lg">
            <CardHeader className="py-4 border-b bg-primary/5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 font-headline">
                  <ShoppingCart className="h-5 w-5 text-primary" /> Carrito
                </CardTitle>
                <Badge variant="secondary" className="text-xs font-bold">{cart.length} items</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0 max-h-[300px] lg:max-h-full">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center min-h-[150px]">
                  <ShoppingCart className="h-10 w-10 mb-2 opacity-10" />
                  <p className="text-sm font-medium">Carrito vacío</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] uppercase font-bold">Item</TableHead>
                        <TableHead className="text-center text-[10px] uppercase font-bold">Cant.</TableHead>
                        <TableHead className="text-right text-[10px] uppercase font-bold">Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cart.map(item => (
                        <TableRow key={item.productId}>
                          <TableCell className="max-w-[120px] truncate text-xs font-medium">{item.productName}</TableCell>
                          <TableCell className="text-center text-xs">{item.quantity}</TableCell>
                          <TableCell className="text-right text-xs font-bold">${item.subtotal.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.productId)} className="text-destructive h-7 w-7 p-0">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex-col border-t bg-muted/20 p-4 lg:p-6 space-y-4">
              <div className="w-full space-y-2">
                <div className="flex justify-between text-xs lg:text-sm">
                  <span className="text-muted-foreground">Subtotal Neto:</span>
                  <span className="font-medium">${subtotalNet.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs lg:text-sm">
                  <span className="text-muted-foreground">IVA (21%):</span>
                  <span className="font-medium">${tax.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center pt-2">
                  <span className="text-base lg:text-lg font-bold font-headline">TOTAL:</span>
                  <span className="text-xl lg:text-2xl font-black text-primary font-headline">${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="w-full space-y-3 pt-2">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Factura por:</label>
                      <Select onValueChange={setSelectedBillingCuitId} value={selectedBillingCuitId}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MOCK_BILLING_CONFIGS.map(b => (
                            <SelectItem key={b.id} value={b.id}>{b.name.split(' ')[0]} ({b.cuit})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Tipo Doc.:</label>
                      <Select onValueChange={(v) => setInvoiceType(v as any)} value={invoiceType}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="factura_a">Factura A</SelectItem>
                          <SelectItem value="factura_b">Factura B</SelectItem>
                          <SelectItem value="ticket">Ticket Fiscal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Cliente:</label>
                      <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId || ""}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="final">Consumidor Final</SelectItem>
                          {customers?.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Pago:</label>
                      <Select onValueChange={(v) => setPaymentMethod(v as any)} value={paymentMethod}>
                        <SelectTrigger className="h-9 text-xs">
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
                
                <Button 
                  className="w-full h-12 text-base lg:text-lg font-bold gap-2 shadow-md uppercase tracking-wide" 
                  size="lg" 
                  disabled={cart.length === 0 || isFinishing || (invoiceType === 'factura_a' && (!selectedCustomerId || selectedCustomerId === 'final'))}
                  onClick={handleFinishSale}
                >
                  {isFinishing ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle2 className="h-5 w-5" /> Confirmar Venta</>}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>

      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[425px] no-print rounded-xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="items-center text-center">
            <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center mb-2">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <DialogTitle className="text-xl lg:text-2xl font-headline font-bold">¡Venta Registrada!</DialogTitle>
            <DialogDescription className="text-xs lg:text-sm text-muted-foreground mt-1">
              La transacción se ha guardado correctamente.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/30 p-4 rounded-xl space-y-2 my-2 border border-primary/10 shadow-inner">
             <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-muted-foreground">Monto Total:</span>
                <span className="text-lg font-black text-green-700 font-headline">${total.toFixed(2)}</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-muted-foreground">Comprobante:</span>
                <span className="text-[10px] font-bold uppercase bg-white px-2 py-0.5 rounded border border-primary/20">{getInvoiceLabel(invoiceType)}</span>
             </div>
             <Separator className="bg-muted-foreground/10" />
             <div className="flex flex-col gap-0.5">
                <span className="text-[8px] uppercase font-black text-muted-foreground flex items-center gap-1">
                  <FileCheck className="h-2.5 w-2.5" /> Emisor:
                </span>
                <span className="text-[10px] font-bold text-primary leading-tight">
                  {selectedBillingConfig?.name}
                </span>
             </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:gap-0">
            <Button className="w-full gap-2 h-10 font-bold shadow-sm" variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Imprimir Factura
            </Button>
            <Button className="w-full h-10 text-xs font-medium text-muted-foreground hover:text-primary" variant="ghost" onClick={resetSale}>
              Realizar Otra Venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {lastSale && (
        <div className="print-only p-2 lg:p-4 text-black bg-white min-h-screen font-sans">
          <div className="border-[2px] border-black p-2 lg:p-4 space-y-0 text-[10px] lg:text-[11px] leading-tight shadow-sm">
            <div className="grid grid-cols-11 border-b-[2px] border-black">
              <div className="col-span-5 p-1 lg:p-2 space-y-1">
                <h1 className="text-xl lg:text-2xl font-black uppercase mb-1 tracking-tighter">{lastSale.billingName}</h1>
                <p className="font-bold text-[10px] uppercase">Venta de Celulares y Electrónica</p>
                <p>Dirección Comercial: Av. Principal 1234, CABA</p>
                <p className="font-bold">IVA RESPONSABLE INSCRIPTO</p>
              </div>
              
              <div className="col-span-1 flex flex-col items-center border-x-[2px] border-black relative">
                <div className="w-full h-10 lg:h-14 border-b-[2px] border-black flex items-center justify-center bg-gray-100">
                  <span className="text-3xl lg:text-5xl font-black">{lastSale.invoiceType === 'factura_a' ? 'A' : 'B'}</span>
                </div>
                <div className="p-0.5 lg:p-1 text-center">
                  <p className="font-bold text-[7px] lg:text-[8px] uppercase">COD. 0{lastSale.invoiceType === 'factura_a' ? '1' : '6'}</p>
                </div>
              </div>

              <div className="col-span-5 p-1 lg:p-2 space-y-1 lg:y-2 text-right">
                <h2 className="text-xl lg:text-2xl font-black uppercase tracking-widest">FACTURA</h2>
                <p className="text-xs lg:text-sm font-bold">Nº 0001 - 0000{Math.floor(Math.random() * 9000) + 1000}</p>
                <div className="flex justify-end gap-0.5 lg:gap-1 mt-1 lg:mt-2">
                  <span className="font-bold mr-1 lg:mr-2 text-[9px] lg:text-[10px]">FECHA:</span>
                  <div className="border-[1.5px] border-black px-1 lg:px-2 py-0.5 lg:py-1 w-8 lg:w-10 text-center font-bold bg-gray-50">{new Date(lastSale.date).getDate().toString().padStart(2, '0')}</div>
                  <div className="border-[1.5px] border-black px-1 lg:px-2 py-0.5 lg:py-1 w-8 lg:w-10 text-center font-bold bg-gray-50">{(new Date(lastSale.date).getMonth() + 1).toString().padStart(2, '0')}</div>
                  <div className="border-[1.5px] border-black px-1 lg:px-2 py-0.5 lg:py-1 w-12 lg:w-16 text-center font-bold bg-gray-50">{new Date(lastSale.date).getFullYear()}</div>
                </div>
                <div className="text-right space-y-1 pt-2 lg:pt-3 text-[9px] lg:text-[10px]">
                  <p><span className="font-black">CUIT:</span> {lastSale.billingCuit}</p>
                </div>
              </div>
            </div>

            <div className="p-2 lg:p-3 space-y-3 lg:space-y-4 border-b-[2px] border-black relative bg-white">
              <div className="flex gap-1 lg:gap-2 items-baseline">
                <span className="font-black text-[9px] lg:text-[10px] shrink-0">SEÑOR(ES):</span>
                <span className="border-b-[1.5px] border-dotted border-black flex-1 uppercase font-bold text-xs">{lastSale.customerName}</span>
              </div>
              <div className="flex flex-col lg:flex-row gap-2 lg:gap-4 lg:items-baseline">
                <div className="flex gap-2 flex-1 items-baseline">
                  <span className="font-black text-[9px] lg:text-[10px] shrink-0">DIRECCIÓN:</span>
                  <span className="border-b-[1.5px] border-dotted border-black flex-1 uppercase text-[10px] lg:text-xs">{lastSale.customerAddress}</span>
                </div>
                <div className="flex gap-2 lg:w-1/3 items-baseline">
                  <span className="font-black text-[9px] lg:text-[10px] shrink-0">CUIT:</span>
                  <span className="border-b-[1.5px] border-dotted border-black flex-1 font-bold text-[10px] lg:text-xs">{lastSale.customerCuit}</span>
                </div>
              </div>
            </div>

            <div className="p-1 lg:p-2 grid grid-cols-3 border-b-[2px] border-black bg-gray-50 font-black uppercase text-[8px] lg:text-[9px]">
              <div className="flex items-center gap-4 lg:gap-10">
                <div className="flex items-center gap-1 lg:gap-2">
                  <span>CONTADO</span>
                  <div className="w-5 h-5 lg:w-6 lg:h-6 border-[2px] border-black flex items-center justify-center bg-white">{lastSale.paymentMethod !== 'credit_account' ? 'X' : ''}</div>
                </div>
                <div className="flex items-center gap-1 lg:gap-2">
                  <span>CTA. CTE.</span>
                  <div className="w-5 h-5 lg:w-6 lg:h-6 border-[2px] border-black flex items-center justify-center bg-white">{lastSale.paymentMethod === 'credit_account' ? 'X' : ''}</div>
                </div>
              </div>
            </div>

            <div className="min-h-[300px] lg:min-h-[400px] bg-white">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-[2px] border-black text-[9px] lg:text-[10px] font-black bg-gray-100">
                    <th className="border-r-[2px] border-black p-1 lg:p-2 w-12 lg:w-16 text-center">CANT.</th>
                    <th className="border-r-[2px] border-black p-1 lg:p-2 text-left">DESCRIPCIÓN</th>
                    <th className="border-r-[2px] border-black p-1 lg:p-2 w-24 lg:w-32 text-right">P. UNITARIO</th>
                    <th className="p-1 lg:p-2 w-24 lg:w-32 text-right">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="text-[10px] lg:text-[11px]">
                  {lastSale.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-200 h-7 lg:h-8">
                      <td className="border-r-[2px] border-black p-1 lg:p-2 text-center font-bold">{item.quantity}</td>
                      <td className="border-r-[2px] border-black p-1 lg:p-2 uppercase font-medium">{item.productName}</td>
                      <td className="border-r-[2px] border-black p-1 lg:p-2 text-right">${item.price.toFixed(2)}</td>
                      <td className="p-1 lg:p-2 text-right font-black">${item.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-auto border-t-[2px] border-black">
              <div className="grid grid-cols-4 text-center font-black text-[8px] lg:text-[10px] border-b-[2px] border-black uppercase bg-gray-100">
                <div className="border-r-[2px] border-black p-1 lg:p-2">Subtotal Neto</div>
                <div className="border-r-[2px] border-black p-1 lg:p-2">IVA 21%</div>
                <div className="border-r-[2px] border-black p-1 lg:p-2">Exento</div>
                <div className="p-1 lg:p-2 bg-black text-white">Total AR$</div>
              </div>
              <div className="grid grid-cols-4 text-center font-black text-sm lg:text-base border-b-[2px] border-black">
                <div className="border-r-[2px] border-black p-2 lg:p-3">${lastSale.subtotal.toFixed(2)}</div>
                <div className="border-r-[2px] border-black p-2 lg:p-3">${lastSale.tax.toFixed(2)}</div>
                <div className="border-r-[2px] border-black p-2 lg:p-3">$0.00</div>
                <div className="p-2 lg:p-3 bg-gray-200 text-xl lg:text-2xl font-black">${lastSale.total.toFixed(2)}</div>
              </div>

              <div className="flex justify-between items-center p-2 lg:p-4">
                <div className="h-8 lg:h-10 w-48 lg:w-64 bg-black"></div>
                <div className="text-right">
                  <p className="text-[9px] lg:text-[10px] font-black uppercase">CAE Nº: 34129987456321</p>
                  <p className="text-[7px] lg:text-[8px] font-bold">Vto. CAE: {new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
