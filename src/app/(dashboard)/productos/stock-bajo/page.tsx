
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
    return products.filter(p => p.stock < p.minStock)
  }, [products])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl lg:text-3xl font-bold font-headline text-destructive flex items-center gap-2">
          <AlertTriangle className="h-8 w-8" /> Stock Bajo
        </h1>
        <p className="text-sm text-muted-foreground">Productos que requieren reposición inmediata según su stock mínimo.</p>
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
                  <p className="text-muted-foreground">¡Excelente! Todos los productos están por encima del stock mínimo.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="min-w-[150px]">Modelo</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-center">Stock Actual</TableHead>
                      <TableHead className="text-center">Stock Mínimo</TableHead>
                      <TableHead className="text-right">Diferencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStockProducts.map((product) => (
                      <TableRow key={product.id} className="hover:bg-destructive/5">
                        <TableCell className="font-medium text-sm">{product.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <Badge variant="outline" className="w-fit text-[10px]">{product.category}</Badge>
                            <span className="text-[10px] text-muted-foreground">{product.subCategory}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-destructive font-black text-lg">
                            {product.stock}
                          </span>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {product.minStock}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="destructive" className="font-bold">
                            Faltan {product.minStock - product.stock} u.
                          </Badge>
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
