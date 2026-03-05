
"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { Calendar, Download, TrendingUp, DollarSign, Package, Users, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection } from "firebase/firestore"
import { Product, Sale } from "@/lib/types"

const COLORS = ['#A7D1AB', '#859F87', '#34D399', '#059669'];

export default function ReportsPage() {
  const firestore = useFirestore()
  const { user } = useUser()

  const productsRef = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'products') : null, 
  [firestore, user])
  const { data: products, isLoading: isProductsLoading } = useCollection<Product>(productsRef)

  const salesRef = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'sales') : null, 
  [firestore, user])
  const { data: sales, isLoading: isSalesLoading } = useCollection<Sale>(salesRef)

  const conditionData = useMemo(() => {
    if (!products) return []
    const counts = products.reduce((acc: any, p) => {
      const cond = p.condition || 'Nuevo'
      acc[cond] = (acc[cond] || 0) + 1
      return acc
    }, {})
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }))
  }, [products])

  const totalSalesAmount = useMemo(() => {
    if (!sales) return 0
    return sales.reduce((acc, s) => acc + (s.total || 0), 0)
  }, [sales])

  if (isProductsLoading || isSalesLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Analizando datos del negocio...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold font-headline">Reportes y Estadísticas</h1>
          <p className="text-muted-foreground">Análisis de inventario y rendimiento comercial.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="gap-2"><Calendar className="h-4 w-4" /> Histórico</Button>
           <Button className="gap-2"><Download className="h-4 w-4" /> Exportar</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
             <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><DollarSign className="h-5 w-5" /></div>
                <div><p className="text-xs text-muted-foreground font-medium uppercase">Ventas Históricas</p><p className="text-2xl font-bold font-headline">${totalSalesAmount.toFixed(2)}</p></div>
             </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
             <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-700"><Package className="h-5 w-5" /></div>
                <div><p className="text-xs text-muted-foreground font-medium uppercase">Total Items</p><p className="text-2xl font-bold font-headline">{products?.length || 0}</p></div>
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
         <Card>
            <CardHeader>
              <CardTitle>Inventario por Estado</CardTitle>
              <CardDescription>Distribución de equipos nuevos vs usados en stock.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={conditionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label
                  >
                    {conditionData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
         </Card>

         <Card>
            <CardHeader>
              <CardTitle>Top Productos</CardTitle>
              <CardDescription>Items con mayor rotación registrados.</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="space-y-4">
                  {(products || []).slice(0, 5).map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border">
                       <div>
                          <p className="font-bold text-sm">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-black">{item.condition} - {item.subCategory}</p>
                       </div>
                       <Badge variant="outline" className="font-bold">{item.stock} u.</Badge>
                    </div>
                  ))}
                  {(!products || products.length === 0) && <p className="text-center py-10 text-muted-foreground italic">No hay datos suficientes.</p>}
               </div>
            </CardContent>
         </Card>
      </div>
    </div>
  )
}
