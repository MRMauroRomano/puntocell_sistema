
"use client"

import { useMemo } from "react"
import { StatCard } from "@/components/dashboard/stat-card"
import { TrendingUp, Users, DollarSign, AlertTriangle, ArrowRight, Package } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection } from "firebase/firestore"
import { Product, Customer, Sale } from "@/lib/types"

export default function DashboardPage() {
  const firestore = useFirestore()
  const { user } = useUser()

  // Obtener productos reales segmentados por usuario
  const productsRef = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'products') : null, 
  [firestore, user])
  const { data: products } = useCollection<Product>(productsRef)

  // Obtener clientes reales segmentados por usuario
  const customersRef = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'customers') : null, 
  [firestore, user])
  const { data: customers } = useCollection<Customer>(customersRef)

  // Obtener ventas reales segmentadas por usuario
  const salesRef = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'sales') : null, 
  [firestore, user])
  const { data: sales } = useCollection<Sale>(salesRef)

  // Cálculo de ventas de hoy
  const todayStats = useMemo(() => {
    if (!sales) return { total: 0, count: 0 }
    const today = new Date().setHours(0, 0, 0, 0)
    const filtered = sales.filter(s => {
      const saleDate = new Date(s.date).setHours(0, 0, 0, 0)
      return saleDate === today && s.status !== 'returned'
    })
    return {
      total: filtered.reduce((acc, s) => acc + (s.total || 0), 0),
      count: filtered.length
    }
  }, [sales])

  const lowStockCount = useMemo(() => {
    if (!products) return 0
    return products.filter(p => (Number(p.stock) || 0) < (Number(p.minStock) || 0)).length
  }, [products])

  const lowStockProducts = useMemo(() => {
    if (!products) return []
    return products.filter(p => (Number(p.stock) || 0) < (Number(p.minStock) || 0)).slice(0, 5)
  }, [products])

  const totalDebt = useMemo(() => {
    if (!customers) return 0
    return customers.reduce((acc, curr) => acc + (curr.balance || 0), 0)
  }, [customers])

  const topDebtors = useMemo(() => {
    if (!customers) return []
    return [...customers]
      .filter(c => (c.balance || 0) > 0)
      .sort((a, b) => (b.balance || 0) - (a.balance || 0))
      .slice(0, 5)
  }, [customers])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold font-headline">Resumen de mi Tienda</h1>
        <p className="text-muted-foreground">Bienvenido al panel exclusivo de tu negocio.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Ventas del Día" 
          value={`$${todayStats.total.toFixed(2)}`} 
          description="hoy" 
          icon={DollarSign}
        />
        
        <Link href="/productos/stock-bajo" className="block transition-transform hover:scale-[1.02] active:scale-[0.98]">
          <StatCard 
            title="Productos Bajo Stock" 
            value={lowStockCount} 
            description="necesitan reposición" 
            icon={AlertTriangle}
            className={lowStockCount > 0 ? "border-red-500/50 bg-red-50/50" : ""}
          />
        </Link>

        <Link href="/cuenta-corriente" className="block transition-transform hover:scale-[1.02] active:scale-[0.98]">
          <StatCard 
            title="Deuda de Clientes" 
            value={`$${totalDebt.toFixed(2)}`} 
            description="total pendiente" 
            icon={Users}
            className={totalDebt > 0 ? "border-amber-500/50 bg-amber-50/50" : ""}
          />
        </Link>

        <StatCard 
          title="Transacciones Hoy" 
          value={todayStats.count} 
          description="ventas realizadas" 
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg font-headline">Alertas de Stock</CardTitle>
              <CardDescription>Productos que requieren atención inmediata.</CardDescription>
            </div>
            <Link href="/productos/stock-bajo">
              <Button variant="ghost" size="sm" className="gap-1">
                Ver todos <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lowStockProducts.map(product => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-red-100 flex items-center justify-center">
                      <Package className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-red-600 font-bold">Stock: {product.stock} / Mín: {product.minStock}</p>
                    </div>
                  </div>
                  <Link href={`/productos`}>
                    <Button variant="outline" size="sm" className="bg-white">Gestionar</Button>
                  </Link>
                </div>
              ))}
              {lowStockCount === 0 && (
                <p className="text-center py-8 text-muted-foreground italic text-sm">No hay alertas de stock pendientes.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg font-headline">Clientes con Deuda</CardTitle>
              <CardDescription>Mayores saldos pendientes en cuenta corriente.</CardDescription>
            </div>
            <Link href="/cuenta-corriente">
              <Button variant="ghost" size="sm" className="gap-1">
                Gestionar <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topDebtors.map(customer => (
                <div key={customer.id} className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{customer.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono uppercase">ID: {customer.id.slice(0,8)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-sm text-red-600">${(customer.balance || 0).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Saldo</p>
                  </div>
                </div>
              ))}
              {topDebtors.length === 0 && (
                <p className="text-center py-8 text-muted-foreground italic text-sm">No hay saldos pendientes registrados.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
