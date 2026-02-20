
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Printer, RotateCcw, Eye, Loader2, Trash2, Calendar as CalendarIcon, FileText } from "lucide-react"
import { Sale, Product } from "@/lib/types"
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from "@/firebase"
import { collection, doc, getDoc } from "firebase/firestore"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function SalesHistoryPage() {
  const firestore = useFirestore()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false)
  const [isReturning, setIsReturning] = useState(false)

  const salesRef = useMemoFirebase(() => collection(firestore, 'sales'), [firestore])
  const { data: sales, isLoading } = useCollection<Sale>(salesRef)

  const filteredSales = useMemo(() => {
    if (!sales) return []
    return [...sales]
      .filter(s => 
        s.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [sales, searchTerm])

  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print()
  }

  const handleReturnSale = async (sale: Sale) => {
    if (sale.status === 'returned') return
    setIsReturning(true)
    try {
      // 1. Devolver el stock a los productos
      for (const item of sale.items) {
        const productRef = doc(firestore, 'products', item.productId)
        const productSnap = await getDoc(productRef)
        if (productSnap.exists()) {
          const currentStock = productSnap.data().stock || 0
          updateDocumentNonBlocking(productRef, { stock: currentStock + item.quantity })
        }
      }

      // 2. Si fue venta a cuenta corriente, descontar la deuda del cliente
      if (sale.paymentMethod === 'credit_account' && sale.customerId && sale.customerId !== 'final') {
        const customerRef = doc(firestore, 'customers', sale.customerId)
        const customerSnap = await getDoc(customerRef)
        if (customerSnap.exists()) {
          const currentBalance = customerSnap.data().balance || 0
          updateDocumentNonBlocking(customerRef, { balance: Math.max(0, currentBalance - sale.total) })
        }
      }

      // 3. Cambiar estado a "returned" (AFIP compliance: NO BORRAR, emitir Nota de Crédito)
      const saleDocRef = doc(firestore, 'sales', sale.id)
      updateDocumentNonBlocking(saleDocRef, { status: 'returned' })

      toast({
        title: "Nota de Crédito Generada",
        description: "El stock ha sido restaurado y la venta se marca como devuelta.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo procesar la devolución.",
      })
    } finally {
      setIsReturning(false)
    }
  }

  const openInvoice = (sale: Sale) => {
    setSelectedSale(sale)
    setIsInvoiceOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 no-print">
        <h1 className="text-3xl font-bold font-headline text-primary">Historial de Ventas</h1>
        <p className="text-muted-foreground text-sm">Consulta y gestiona todos los comprobantes emitidos.</p>
      </div>

      <Card className="shadow-sm border-primary/10 no-print">
        <CardHeader className="pb-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por ID de venta o nombre de cliente..." 
              className="pl-9 bg-muted/30 border-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Recuperando historial...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>ID Venta</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id} className={cn("hover:bg-primary/5", sale.status === 'returned' && "opacity-60 bg-red-50/30")}>
                      <TableCell className="text-xs font-medium">
                        {format(new Date(sale.date), "dd/MM/yyyy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell className="font-mono text-[10px] uppercase">
                        #{sale.id.slice(-6)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-bold flex items-center gap-2">
                          {sale.customerName}
                          {sale.status === 'returned' && <Badge variant="destructive" className="text-[8px] h-4">DEVUELTO</Badge>}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{sale.customerCuit}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {sale.invoiceType ? sale.invoiceType.replace('_', ' ') : 'TICKET'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-black text-primary">
                        ${sale.total.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-primary"
                            onClick={() => openInvoice(sale)}
                            title="Ver Comprobante"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {sale.status !== 'returned' && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-destructive hover:bg-red-50"
                                  title="Devolver / Nota de Crédito"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Generar Nota de Crédito?</AlertDialogTitle>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Generar Nota de Crédito?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción anulará legalmente la venta #{sale.id.slice(-6)}, devolverá el stock al inventario y ajustará el saldo del cliente. Se mantendrá el registro como "Devuelto".
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleReturnSale(sale)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Confirmar Devolución
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredSales.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">
                        No se encontraron registros de ventas.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIÁLOGO DE FACTURA PARA REIMPRESIÓN / NOTA DE CRÉDITO */}
      <Dialog open={isInvoiceOpen} onOpenChange={setIsInvoiceOpen}>
        <DialogContent className="max-w-[850px] w-[95vw] h-[90vh] overflow-y-auto no-print rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Vista Previa del Comprobante
            </DialogTitle>
          </DialogHeader>
          
          <div className="bg-white p-4 border rounded-lg shadow-inner overflow-x-auto">
            {selectedSale && (
              <div id="invoice-print-area" className="w-[800px] mx-auto text-black p-8 border-[2px] border-black rounded-sm bg-white font-sans scale-90 origin-top">
                <div className="border-[2px] border-black relative">
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 bg-white border-b-[2px] border-x-[2px] border-black w-16 h-16 flex flex-col items-center justify-center z-10">
                    <span className="text-5xl font-black leading-none mt-1">
                      {selectedSale.invoiceType === 'factura_a' ? 'A' : selectedSale.invoiceType === 'factura_b' ? 'B' : 'C'}
                    </span>
                    <span className="text-[9px] font-bold uppercase mb-1">cod. 01</span>
                  </div>

                  <div className="grid grid-cols-2 h-36">
                    <div className="p-4 flex flex-col justify-center border-r-[1px] border-black/50">
                      <h1 className="text-3xl font-black uppercase leading-tight tracking-tight">{selectedSale.billingName || "COMERCIO PRO"}</h1>
                      <p className="text-[11px] font-black mt-2">RAZÓN SOCIAL TITULAR</p>
                      <p className="text-[11px]">Dirección Comercial: Av. Principal 1234</p>
                      <p className="text-[11px]">Condición frente al IVA: Responsable Inscripto</p>
                    </div>

                    <div className="p-4 flex flex-col justify-center pl-14">
                      <h2 className="text-3xl font-black tracking-tighter mb-1">
                        {selectedSale.status === 'returned' ? 'NOTA DE CRÉDITO' : 'FACTURA'}
                      </h2>
                      <p className="font-black text-base">Punto de Venta: 0001</p>
                      <p className="font-black text-base">Comp. Nro: 000{selectedSale.id.slice(-5)}</p>
                      <p className="font-black text-base">Fecha de Emisión: {new Date(selectedSale.date).toLocaleDateString('es-AR')}</p>
                    </div>
                  </div>

                  <div className="border-t-[2px] border-black grid grid-cols-2 px-6 py-1 text-[11px] font-bold bg-gray-50">
                    <div>CUIT: {selectedSale.billingCuit || "30-00000000-0"}</div>
                    <div className="flex justify-between">
                      <span>Ingresos Brutos: {selectedSale.billingCuit || "30-00000000-0"}</span>
                      <span>Inicio de Actividades: 01/01/2024</span>
                    </div>
                  </div>
                </div>

                <div className="border-b-[2px] border-black grid grid-cols-2 bg-white">
                  <div className="p-4 border-r-[2px] border-black">
                    <p className="text-[10px] uppercase font-black text-gray-500 mb-1">DATOS DEL CLIENTE</p>
                    <p className="font-black text-base">{selectedSale.customerName}</p>
                    <p className="text-sm font-medium">Domicilio no registrado</p>
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] uppercase font-black text-gray-500 mb-1">CONDICIÓN / IDENTIFICACIÓN</p>
                    <p className="font-black text-base font-mono">CUIT: {selectedSale.customerCuit}</p>
                    <p className="text-sm uppercase font-black">IVA: {selectedSale.customerId === 'final' ? 'Consumidor Final' : 'RESP. INSCRIPTO'}</p>
                  </div>
                </div>

                <div className="min-h-[400px]">
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
                      {selectedSale.items.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-300">
                          <td className="p-3 border-r-[2px] border-black text-center text-sm">{item.quantity}</td>
                          <td className="p-3 border-r-[2px] border-black uppercase tracking-tight">{item.productName}</td>
                          <td className="p-3 border-r-[2px] border-black text-right font-mono">${item.price.toFixed(2)}</td>
                          <td className="p-3 text-right font-black font-mono">${item.subtotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-t-[2px] border-black p-6 flex justify-between items-end bg-gray-50">
                  <div className="text-[10px] font-bold space-y-2">
                    <p className="uppercase text-gray-600">Observaciones: {selectedSale.status === 'returned' ? 'DEVOLUCIÓN DE MERCADERÍA' : (selectedSale.paymentMethod === 'credit_account' ? 'VENTA A CUENTA CORRIENTE' : 'VENTA CONTADO')}</p>
                    <p className="italic">Comprobante generado desde CommerceManager Pro</p>
                  </div>
                  <div className="w-80 space-y-2">
                    <div className="flex justify-between border-b border-black/20 pb-1">
                      <span className="text-[13px] font-bold">Subtotal:</span>
                      <span className="text-[13px] font-black font-mono">${selectedSale.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-b border-black/20 pb-1">
                      <span className="text-[13px] font-bold">IVA (21%):</span>
                      <span className="text-[13px] font-black font-mono">${selectedSale.tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-2xl font-black uppercase tracking-tighter">TOTAL:</span>
                      <span className="text-3xl font-black font-mono tracking-tight">${selectedSale.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="no-print">
            <Button variant="outline" onClick={() => setIsInvoiceOpen(false)}>Cerrar</Button>
            <Button className="gap-2" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
