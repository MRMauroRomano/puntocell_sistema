
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts"
import { Calendar, Download, Filter, TrendingUp, DollarSign, Package, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const data = [
  { name: 'Lun', ventas: 4000 },
  { name: 'Mar', ventas: 3000 },
  { name: 'Mie', ventas: 2000 },
  { name: 'Jue', ventas: 2780 },
  { name: 'Vie', ventas: 1890 },
  { name: 'Sab', ventas: 2390 },
  { name: 'Dom', ventas: 3490 },
];

const categoryData = [
  { name: 'Smartphones', value: 450 },
  { name: 'Computación', value: 300 },
  { name: 'Audio', value: 150 },
  { name: 'Accesorios', value: 100 },
];

const COLORS = ['#A7D1AB', '#C4D7A8', '#859F87', '#5C745E'];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold font-headline">Reportes y Estadísticas</h1>
          <p className="text-muted-foreground">Analiza el rendimiento de tu tienda de tecnología.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="gap-2">
             <Calendar className="h-4 w-4" /> Últimos 30 días
           </Button>
           <Button className="gap-2">
             <Download className="h-4 w-4" /> Exportar Reporte
           </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
             <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                   <DollarSign className="h-5 w-5" />
                </div>
                <div>
                   <p className="text-sm text-muted-foreground font-medium">Ventas Totales</p>
                   <p className="text-2xl font-bold font-headline">$145,280.00</p>
                </div>
             </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
             <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-700">
                   <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                   <p className="text-sm text-muted-foreground font-medium">Margen Promedio</p>
                   <p className="text-2xl font-bold font-headline">18.4%</p>
                </div>
             </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
             <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                   <Package className="h-5 w-5" />
                </div>
                <div>
                   <p className="text-sm text-muted-foreground font-medium">Productos Activos</p>
                   <p className="text-2xl font-bold font-headline">86</p>
                </div>
             </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
             <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700">
                   <Users className="h-5 w-5" />
                </div>
                <div>
                   <p className="text-sm text-muted-foreground font-medium">Clientes Registrados</p>
                   <p className="text-2xl font-bold font-headline">1,240</p>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ventas" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="ventas">Ventas</TabsTrigger>
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
          <TabsTrigger value="rendimiento">Rendimiento</TabsTrigger>
        </TabsList>
        <TabsContent value="ventas" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Evolución de Ventas Semanal</CardTitle>
              <CardDescription>Ingresos generados por ventas de hardware y servicios técnicos.</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{fill: 'rgba(167, 209, 171, 0.1)'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                  />
                  <Bar dataKey="ventas" fill="#A7D1AB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="categorias" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2">
             <Card>
                <CardHeader>
                  <CardTitle>Ventas por Categoría</CardTitle>
                  <CardDescription>Distribución porcentual del volumen de ventas.</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
             </Card>
             <Card>
                <CardHeader>
                  <CardTitle>Top Productos</CardTitle>
                  <CardDescription>Los 5 productos más vendidos este mes.</CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="space-y-4">
                      {[
                        { name: 'iPhone 15 Pro', qty: 42, growth: '+25%' },
                        { name: 'Cargador 20W USB-C', qty: 156, growth: '+12%' },
                        { name: 'Samsung Galaxy S24', qty: 28, growth: '+8%' },
                        { name: 'AirPods Pro (2nd)', qty: 35, growth: '+15%' },
                        { name: 'Funda Protectora', qty: 120, growth: '+5%' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                           <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-muted-foreground w-4">{i+1}</span>
                              <span className="font-medium">{item.name}</span>
                           </div>
                           <div className="flex items-center gap-4">
                              <span className="text-sm font-bold">{item.qty} u.</span>
                              <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", item.growth.startsWith('+') ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                                {item.growth}
                              </span>
                           </div>
                        </div>
                      ))}
                   </div>
                </CardContent>
             </Card>
          </div>
        </TabsContent>
        <TabsContent value="rendimiento" className="mt-4">
          <Card>
             <CardHeader>
               <CardTitle>Comparativa de Crecimiento</CardTitle>
               <CardDescription>Ventas de nuevos lanzamientos vs stock permanente.</CardDescription>
             </CardHeader>
             <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="ventas" stroke="#A7D1AB" strokeWidth={3} dot={{fill: '#A7D1AB', r: 6}} activeDot={{r: 8}} />
                  </LineChart>
                </ResponsiveContainer>
             </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
