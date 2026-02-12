"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, Trash2, ShoppingCart, User, CreditCard, DollarSign, Printer, CheckCircle2, FileCheck, Tag, Loader2 } from "lucide-react"
import { MOCK_CUSTOMERS, MOCK_BILLING_CONFIGS } from "@/lib/mock-data"
import { Product, SaleItem, PaymentMethod } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection } from "firebase/firestore"

export default function SalesPage() {
  const firestore = useFirestore()
  const [cart, setCart] = useState<SaleItem[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [selectedBillingCuitId, setSelectedBillingCuitId] = useState<string>(MOCK_BILLING_CONFIGS[0].id)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false)

  // Fetch products from Firestore
  const productsRef = useMemoFirebase(() => collection(firestore, 'products'), [firestore])
  const { data: products, isLoading } = useCollection<Product>(productsRef)

  const categories = useMemo(() => {
    if (!products) return ["all"]
    return ["all", ...Array.from(new Set(products.map(p => p.category)))]
  }, [products])

  const filteredProducts = useMemo(() => {
    if (!products) return []
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           p.sku.toLowerCase().includes(searchTerm.toLowerCase())
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

  const subtotal = cart.reduce((acc, curr) => acc + curr.subtotal, 0)
  const tax = subtotal * 0.21
  const total = subtotal + tax

  const selectedBillingConfig = MOCK_BILLING_CONFIGS.find(b => b.id === selectedBillingCuitId)

  const handleFinishSale = () => {
    setIsSuccessDialogOpen(true)
  }

  const resetSale = () => {
    setCart([])
    setSelectedCustomerId(null)
    setPaymentMethod('cash')
    setIsSuccessDialogOpen(false)
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
      {/* Product Selection */}
      <div className="lg:col-span-7 space-y-4 flex flex-col">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nombre o SKU..." 
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
            {isLoading ? (
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
                          <span className="text-[10px] text-muted-foreground font-mono">{product.sku}</span>
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
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Impuestos (21%):</span>
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
                    <label className="text-xs font-bold uppercase text-muted-foreground">Facturar como:</label>
                    <Select onValueChange={setSelectedBillingCuitId} value={selectedBillingCuitId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MOCK_BILLING_CONFIGS.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
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
                  <label className="text-xs font-bold uppercase text-muted-foreground">Cliente (Opcional)</label>
                  <Select onValueChange={setSelectedCustomerId} value={selectedCustomerId || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Consumidor Final" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="final">Consumidor Final</SelectItem>
                      {MOCK_CUSTOMERS.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
               </div>
              
              <Button 
                className="w-full h-12 text-lg font-bold gap-2" 
                size="lg" 
                disabled={cart.length === 0}
                onClick={handleFinishSale}
              >
                Finalizar Venta
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
                <span className="text-sm">Método:</span>
                <span className="text-sm font-bold uppercase">{getPaymentMethodLabel(paymentMethod)}</span>
             </div>
             <div className="flex justify-between pt-2 border-t border-muted-foreground/20">
                <span className="text-xs flex items-center gap-1"><FileCheck className="h-3 w-3" /> Facturado por:</span>
                <span className="text-xs font-medium">{selectedBillingConfig?.name}</span>
             </div>
             <div className="flex justify-end">
                <span className="text-[10px] text-muted-foreground">CUIT: {selectedBillingConfig?.cuit}</span>
             </div>
          </div>
          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button className="w-full gap-2" variant="outline">
              <Printer className="h-4 w-4" /> Imprimir Comprobante
            </Button>
            <Button className="w-full" onClick={resetSale}>Nueva Venta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}