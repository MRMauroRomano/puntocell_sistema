
"use client"

import { useState, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, Trash2, ShoppingCart, CreditCard, DollarSign, Printer, CheckCircle2, FileCheck, Tag, Loader2, FileText, User } from "lucide-react"
import { MOCK_BILLING_CONFIGS } from "@/lib/mock-data"
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
  const [selectedBillingCuitId, setSelectedBillingCuitId] = useState<string>(MOCK_BILLING_CONFIGS[0].id)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('factura_b')
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false)
  const [isFinishing, setIsFinishing] = useState(false)
  const [lastSale, setLastSale] = useState<Sale & { customerAddress?: string }> (null as any)

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

  const resetSale = () => {
    setCart([])
    setSelectedCustomerId(null)
    setPaymentMethod('cash')
    setIsSuccessDialogOpen(false)
    setLastSale(null as any)
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-12rem)] no-print">
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
          
          <Card className="flex-1 overflow-hidden flex flex-col shadow-sm">
            <CardHeader className="bg-muted/30 py-3">
              <CardTitle className="text-sm">Catálogo de Productos</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-auto">
              {isProductsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground">Cargando inventario...</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/10 sticky top-0 z-10">
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map(product => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{product.subCategory || "-"}</span>
                        </TableCell>
                        <TableCell className="font-bold text-primary">${product.price.toFixed(2)}</TableCell>
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

        <div className="lg:col-span-5 flex flex-col gap-4">
          <Card className="flex-1 flex flex-col overflow-hidden border-primary/20 bg-white shadow-lg">
            <CardHeader className="py-4 border-b bg-primary/5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" /> Carrito de Venta
                </CardTitle>
                <Badge variant="secondary" className="text-xs">{cart.length} productos</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                  <ShoppingCart className="h-12 w-12 mb-2 opacity-10" />
                  <p className="font-medium">El carrito está vacío</p>
                  <p className="text-xs opacity-60">Selecciona productos del catálogo para comenzar.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-center">Cant.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map(item => (
                      <TableRow key={item.productId}>
                        <TableCell className="max-w-[150px] truncate text-xs font-medium">{item.productName}</TableCell>
                        <TableCell className="text-center text-xs">{item.quantity}</TableCell>
                        <TableCell className="text-right text-xs font-bold">${item.subtotal.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => removeFromCart(item.productId)} className="text-destructive h-8 w-8 p-0">
                            <Trash2 className="h-3.5 w-3.5" />
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
                  <span className="text-lg font-bold">TOTAL:</span>
                  <span className="text-2xl font-bold text-primary font-headline">${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="w-full space-y-4 pt-2">
                 <div className="grid grid-cols-2 gap-3">
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

                 <div className="grid grid-cols-2 gap-3">
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
                  className="w-full h-12 text-lg font-bold gap-2 shadow-md" 
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

        <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader className="items-center text-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-2">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <DialogTitle className="text-2xl font-headline">¡Venta Registrada!</DialogTitle>
              <DialogDescription>
                La transacción se ha guardado correctamente en la base de datos.
              </DialogDescription>
            </DialogHeader>
            <div className="bg-muted/30 p-4 rounded-lg space-y-2 my-4">
               <div className="flex justify-between">
                  <span className="text-sm">Monto Total:</span>
                  <span className="text-sm font-bold text-primary">${total.toFixed(2)}</span>
               </div>
               <div className="flex justify-between">
                  <span className="text-sm">Comprobante:</span>
                  <span className="text-sm font-bold uppercase">{getInvoiceLabel(invoiceType)}</span>
               </div>
               <div className="flex justify-between pt-2 border-t border-muted-foreground/20">
                  <span className="text-[10px] flex items-center gap-1"><FileCheck className="h-3 w-3" /> Emisor:</span>
                  <span className="text-[10px] font-medium">{selectedBillingConfig?.name} ({selectedBillingConfig?.cuit})</span>
               </div>
            </div>
            <DialogFooter className="flex-col sm:flex-col gap-2">
              <Button className="w-full gap-2" variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Imprimir Factura
              </Button>
              <Button className="w-full" onClick={resetSale}>Realizar Otra Venta</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {lastSale && (
        <div className="print-only p-4 text-black bg-white min-h-screen font-sans">
          <div className="border-[2px] border-black p-4 space-y-0 text-[11px] leading-tight">
            {/* Header Section */}
            <div className="grid grid-cols-11 border-b-[2px] border-black">
              <div className="col-span-5 p-2 space-y-1">
                <h1 className="text-2xl font-black uppercase mb-2">{lastSale.billingName}</h1>
                <p className="font-bold text-xs">Venta de Celulares y Electrónica</p>
                <p>Dirección Comercial: Av. Principal 1234, Ciudad</p>
                <p>Teléfono: 0800-TECH-STUDIO</p>
                <p>IVA RESPONSABLE INSCRIPTO</p>
              </div>
              
              <div className="col-span-1 flex flex-col items-center border-x-[2px] border-black">
                <div className="w-full h-14 border-b-[2px] border-black flex items-center justify-center bg-gray-100">
                  <span className="text-5xl font-black">{lastSale.invoiceType === 'factura_a' ? 'A' : 'B'}</span>
                </div>
                <div className="p-1 text-center">
                  <p className="font-bold text-[8px]">COD. 0{lastSale.invoiceType === 'factura_a' ? '1' : '6'}</p>
                </div>
              </div>

              <div className="col-span-5 p-2 space-y-2">
                <div className="flex flex-col items-end">
                  <h2 className="text-2xl font-black uppercase">FACTURA</h2>
                  <p className="text-sm font-bold">Nº 0001 - 0000{Math.floor(Math.random() * 9000) + 1000}</p>
                </div>
                <div className="flex justify-end gap-1 mt-2">
                  <span className="font-bold mr-2">FECHA:</span>
                  <div className="border-[1.5px] border-black px-2 py-0.5 w-10 text-center font-bold">{new Date(lastSale.date).getDate()}</div>
                  <div className="border-[1.5px] border-black px-2 py-0.5 w-10 text-center font-bold">{new Date(lastSale.date).getMonth() + 1}</div>
                  <div className="border-[1.5px] border-black px-2 py-0.5 w-16 text-center font-bold">{new Date(lastSale.date).getFullYear()}</div>
                </div>
                <div className="text-right space-y-1 pt-3 text-[10px]">
                  <p><span className="font-black">CUIT:</span> {lastSale.billingCuit}</p>
                  <p><span className="font-black">INGR. BRUTOS:</span> 30-76543210-9</p>
                  <p><span className="font-black">INICIO ACT.:</span> 01/01/2024</p>
                </div>
              </div>
            </div>

            {/* Client Info Section */}
            <div className="p-3 space-y-3 border-b-[2px] border-black">
              <div className="flex gap-2">
                <span className="font-black">SEÑOR(ES):</span>
                <span className="border-b-[1.5px] border-dotted border-black flex-1 uppercase font-bold">{lastSale.customerName}</span>
              </div>
              <div className="flex gap-4">
                <div className="flex gap-2 flex-1">
                  <span className="font-black">DIRECCIÓN:</span>
                  <span className="border-b-[1.5px] border-dotted border-black flex-1 uppercase">{lastSale.customerAddress}</span>
                </div>
                <div className="flex gap-2 w-1/3">
                  <span className="font-black">LOCALIDAD:</span>
                  <span className="border-b-[1.5px] border-dotted border-black flex-1">CAPITAL FEDERAL</span>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex gap-2 flex-1">
                  <span className="font-black">IVA:</span>
                  <span className="border-b-[1.5px] border-dotted border-black flex-1 uppercase">
                    {lastSale.invoiceType === 'factura_a' ? 'Responsable Inscripto' : 'Consumidor Final'}
                  </span>
                </div>
                <div className="flex gap-2 w-1/3">
                  <span className="font-black">CUIT:</span>
                  <span className="border-b-[1.5px] border-dotted border-black flex-1 font-bold">{lastSale.customerCuit}</span>
                </div>
              </div>
            </div>

            {/* Sales Conditions */}
            <div className="p-2 grid grid-cols-3 border-b-[2px] border-black bg-gray-50 font-bold uppercase text-[9px]">
              <div className="flex items-center gap-2">
                <span>CONDICIÓN DE VENTA</span>
              </div>
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                  <span>CONTADO</span>
                  <div className="w-5 h-5 border-[2px] border-black flex items-center justify-center">{lastSale.paymentMethod === 'cash' ? 'X' : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span>CTA. CTE.</span>
                  <div className="w-5 h-5 border-[2px] border-black flex items-center justify-center">{lastSale.paymentMethod === 'credit_account' ? 'X' : ''}</div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span>REMITO Nº</span>
                <span className="border-b border-black w-32"></span>
              </div>
            </div>

            {/* Items Table */}
            <div className="min-h-[450px]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-[2px] border-black text-[10px] font-black bg-gray-100">
                    <th className="border-r-[2px] border-black p-2 w-16 text-center">CANT.</th>
                    <th className="border-r-[2px] border-black p-2 text-left">DESCRIPCIÓN DE PRODUCTOS / SERVICIOS</th>
                    <th className="border-r-[2px] border-black p-2 w-32 text-right">P. UNITARIO</th>
                    <th className="p-2 w-32 text-right">IMPORTE TOTAL</th>
                  </tr>
                </thead>
                <tbody className="text-[11px]">
                  {lastSale.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="border-r-[2px] border-black p-2 text-center font-bold">{item.quantity}</td>
                      <td className="border-r-[2px] border-black p-2 uppercase font-medium">{item.productName}</td>
                      <td className="border-r-[2px] border-black p-2 text-right">${item.price.toFixed(2)}</td>
                      <td className="p-2 text-right font-black">${item.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                  {/* Empty rows to fill space */}
                  {Array.from({ length: Math.max(0, 15 - lastSale.items.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} className="h-7">
                      <td className="border-r-[2px] border-black"></td>
                      <td className="border-r-[2px] border-black"></td>
                      <td className="border-r-[2px] border-black"></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Section */}
            <div className="mt-auto border-t-[2px] border-black">
              <div className="flex justify-between items-center p-3 bg-gray-50">
                <div className="flex flex-col items-center gap-1">
                   <div className="h-10 w-80 bg-black mb-1"></div>
                   <p className="text-[8px] font-mono tracking-[0.3em]">307654321090600010000{lastSale.id}0</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-[10px] font-black uppercase">Código de Autorización Electrónica</p>
                  <p className="text-[12px] font-black">CAE Nº: 34129987456321</p>
                  <p className="text-[10px] font-bold">Vto. CAE: {new Date(new Date(lastSale.date).getTime() + 10 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Totals Grid */}
              <div className="grid grid-cols-4 text-center font-black text-[10px] border-t-[2px] border-black uppercase bg-gray-100">
                <div className="border-r-[2px] border-black p-2">Subtotal</div>
                <div className="border-r-[2px] border-black p-2">IVA Inscripto 21%</div>
                <div className="border-r-[2px] border-black p-2">Otros Tributos</div>
                <div className="p-2 bg-black text-white">Importe Total $</div>
              </div>
              <div className="grid grid-cols-4 text-center font-black text-lg border-t-[2px] border-black">
                <div className="border-r-[2px] border-black p-3">${lastSale.subtotal.toFixed(2)}</div>
                <div className="border-r-[2px] border-black p-3">${lastSale.tax.toFixed(2)}</div>
                <div className="border-r-[2px] border-black p-3">$0.00</div>
                <div className="p-3 bg-gray-200 text-2xl font-black">${lastSale.total.toFixed(2)}</div>
              </div>
            </div>

            <div className="p-2 text-[8px] border-t-[2px] border-black bg-white flex justify-between italic">
              <span>Original: Blanco | Duplicado: Color</span>
              <span>Comprobante emitido por sistema electrónico de gestión TechStudio.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
