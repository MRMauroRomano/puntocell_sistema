
"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, AlertTriangle, PackageSearch } from "lucide-react"
import { Product } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection } from "firebase/firestore"

export default function LowStockPage() {
  const firestore = useFirestore()

  const productsRef = useMemoFirebase(() => collection(firestore, 'products'), [firestore])
  const { data: products, isLoading } = useCollection<Product>(productsRef)

  const lowStockProducts = useMemo(() => {
    if (!products) return []
    return products.filter(p => (Number(p.stock) || 0) < (Number(p.minStock) || 0))
  }, [products])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl lg:text-3xl font-bold font-headline text-destructive flex items-center gap-2">
          <AlertTriangle className="h-8 w-8" /> Stock Bajo
        </h1>
        <p className="text-sm text-muted-foreground">Equipos que requieren reposición urgente.</p>
      </div>

      <Card className="shadow-sm border-destructive/20 overflow-hidden">
        <CardHeader className="bg-destructive/5 py-4">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-destructive">Alertas de Inventario</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Escaneando inventario...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {lowStockProducts.length === 0 ? (
                <div className="text-center py-20">
                  <PackageSearch className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-20" />
                  <p className="text-muted-foreground">¡Excelente! Todo el stock está bajo control.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-center">Stock Actual</TableHead>
                      <TableHead className="text-right">Alerta Mín.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockProducts.map((product) => (
                      <TableRow key={product.id} className="hover:bg-destructive/5">
                        <TableCell>
                          <div className="font-bold text-sm">{product.name}</div>
                          <div className="text-[10px] text-muted-foreground uppercase font-black">{product.category} - {product.subCategory}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.condition === 'Nuevo' ? 'default' : 'secondary'} className="text-[9px] font-black uppercase">
                            {product.condition}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-black text-destructive text-lg">
                          {product.stock}
                        </TableCell>
                        <TableCell className="text-right font-bold text-muted-foreground">
                          {product.minStock} u.
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
