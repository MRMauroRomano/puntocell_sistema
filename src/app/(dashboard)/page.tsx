
"use client"

import { StatCard } from "@/components/dashboard/stat-card"
import { TrendingUp, Package, Users, DollarSign, AlertTriangle, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MOCK_PRODUCTS, MOCK_CUSTOMERS } from "@/lib/mock-data"
import Link from "next/link"

export default function DashboardPage() {
  const lowStockCount = MOCK_PRODUCTS.filter(p => p.stock < p.minStock).length
  const totalDebt = MOCK_CUSTOMERS.reduce((acc, curr) => acc + curr.balance, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold font-headline">Resumen General</h1>
        <p className="text-muted-foreground">Bienvenido al panel de control de CommerceManager Pro.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Ventas del Día" 
          value="$1,280.50" 
          description="vs ayer" 
          icon={DollarSign}
          trend={{ value: "+12.5%", positive: true }}
        />
        <StatCard 
          title="Productos Bajo Stock" 
          value={lowStockCount} 
          description="necesitan reposición" 
          icon={AlertTriangle}
          className={lowStockCount > 0 ? "border-red-200" : ""}
        />
        <StatCard 
          title="Deuda de Clientes" 
          value={`$${totalDebt.toFixed(2)}`} 
          description="total pendiente" 
          icon={Users}
        />
        <StatCard 
          title="Transacciones Hoy" 
          value="24" 
          description="ventas realizadas" 
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Alertas de Stock</CardTitle>
              <CardDescription>Productos que requieren atención inmediata.</CardDescription>
            </div>
            <Link href="/productos">
              <Button variant="ghost" size="sm" className="gap-1">
                Ver todos <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {MOCK_PRODUCTS.filter(p => p.stock < p.minStock).map(product => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-red-100 flex items-center justify-center">
                      <Package className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-red-600 font-medium">Stock: {product.stock} / Mín: {product.minStock}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="bg-white">Reponer</Button>
                </div>
              ))}
              {lowStockCount === 0 && (
                <p className="text-center py-4 text-muted-foreground italic">No hay alertas de stock pendientes.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Clientes con Deuda</CardTitle>
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
              {MOCK_CUSTOMERS.filter(c => c.balance > 0).sort((a,b) => b.balance - a.balance).map(customer => (
                <div key={customer.id} className="flex items-center justify-between p-3 rounded-lg border bg-white">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-accent/20 flex items-center justify-center">
                      <Users className="h-5 w-5 text-accent-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">{customer.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-red-600">${customer.balance.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Saldo</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
