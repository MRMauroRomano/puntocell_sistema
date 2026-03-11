"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Search, Trash2, Wallet, Calendar, Loader2, Save, AlertCircle } from "lucide-react"
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, useUser } from "@/firebase"
import { collection, doc, serverTimestamp } from "firebase/firestore"
import { Expense } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import { es } from "date-fns/locale"

const EXPENSE_CATEGORIES = [
  "Mercadería",
  "Alquiler",
  "Servicios (Luz/Agua/Gas)",
  "Sueldos",
  "Mantenimiento",
  "Publicidad",
  "Impuestos",
  "Otros"
]

export default function ExpensesPage() {
  const firestore = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [currentDate, setCurrentDate] = useState<Date | null>(null)

  useEffect(() => {
    setCurrentDate(new Date())
  }, [])

  const expensesRef = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'expenses') : null, 
  [firestore, user])
  const { data: expenses, isLoading } = useCollection<Expense>(expensesRef)

  const [formExpense, setFormExpense] = useState<Partial<Expense>>({
    description: "",
    category: "Otros",
    amount: 0,
    paymentMethod: "Efectivo",
    date: new Date().toISOString()
  })

  const filtered = useMemo(() => {
    if (!expenses) return []
    return expenses
      .filter(e => {
        const matchesSearch = e.description.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesCategory = selectedCategory === "all" || e.category === selectedCategory
        return matchesSearch && matchesCategory
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [expenses, searchTerm, selectedCategory])

  const totalMonth = useMemo(() => {
    if (!expenses || !currentDate) return 0
    return expenses
      .filter(e => {
        const d = new Date(e.date)
        return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear()
      })
      .reduce((acc, curr) => acc + curr.amount, 0)
  }, [expenses, currentDate])

  const handleSaveExpense = () => {
    if (!user || !formExpense.description || !formExpense.amount || formExpense.amount <= 0) {
      toast({
        variant: "destructive",
        title: "Campos incompletos",
        description: "Por favor, completa la descripción y un monto válido.",
      })
      return
    }

    setIsSaving(true)
    const expenseId = Math.random().toString(36).substr(2, 9)
    const expenseDocRef = doc(firestore, 'users', user.uid, 'expenses', expenseId)

    const expenseData = {
      ...formExpense,
      id: expenseId,
      amount: Number(formExpense.amount),
      createdAt: serverTimestamp()
    }

    try {
      setDocumentNonBlocking(expenseDocRef, expenseData, { merge: true })
      toast({ title: "Gasto registrado con éxito" })
      setIsDialogOpen(false)
      setFormExpense({
        description: "",
        category: "Otros",
        amount: 0,
        paymentMethod: "Efectivo",
        date: new Date().toISOString()
      })
    } catch (error) {
      // Handled centrally
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteExpense = (id: string) => {
    if (!user) return
    if (confirm("¿Estás seguro de eliminar este registro de gasto?")) {
      const docRef = doc(firestore, 'users', user.uid, 'expenses', id)
      deleteDocumentNonBlocking(docRef)
      toast({ title: "Gasto eliminado" })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl lg:text-3xl font-bold font-headline text-primary">Control de Gastos</h1>
          <p className="text-sm text-muted-foreground">Registra y monitorea las salidas de dinero de tu negocio.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto gap-2 shadow-sm">
              <Plus className="h-4 w-4" /> Registrar Gasto
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] sm:max-w-[425px] rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-headline">Nuevo Registro de Gasto</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="desc">Descripción / Concepto</Label>
                <Input 
                  id="desc" 
                  placeholder="Ej: Pago de Alquiler Local" 
                  value={formExpense.description}
                  onChange={(e) => setFormExpense({...formExpense, description: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select 
                    value={formExpense.category} 
                    onValueChange={(v) => setFormExpense({...formExpense, category: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Monto ($)</Label>
                  <Input 
                    id="amount" 
                    type="number" 
                    placeholder="0.00" 
                    value={formExpense.amount || ""}
                    onChange={(e) => setFormExpense({...formExpense, amount: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Medio de Pago</Label>
                  <Select 
                    value={formExpense.paymentMethod} 
                    onValueChange={(v) => setFormExpense({...formExpense, paymentMethod: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Efectivo">Efectivo</SelectItem>
                      <SelectItem value="Transferencia">Transferencia</SelectItem>
                      <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Fecha</Label>
                  <Input 
                    id="date" 
                    type="date"
                    value={formExpense.date?.split('T')[0]}
                    onChange={(e) => setFormExpense({...formExpense, date: new Date(e.target.value).toISOString()})}
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
              <Button onClick={handleSaveExpense} className="w-full sm:w-auto gap-2" disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar Gasto
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-red-50 border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-800">Gasto Mensual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl lg:text-3xl font-bold text-red-900 font-headline">${totalMonth.toFixed(2)}</div>
            <p className="text-[10px] lg:text-xs text-red-700 mt-1 uppercase font-bold tracking-tight">Acumulado en {currentDate ? format(currentDate, 'MMMM', { locale: es }) : '...'}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-primary/10 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex flex-col sm:flex-row flex-1 gap-2 w-full">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar gasto..." 
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
                  <SelectItem value="all">Todas</SelectItem>
                  {EXPENSE_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Cargando...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="min-w-[100px]">Fecha</TableHead>
                    <TableHead className="min-w-[150px]">Descripción</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(expense.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="font-medium text-xs">{expense.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] whitespace-nowrap">{expense.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600 text-sm">
                        -${expense.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:bg-red-50"
                          onClick={() => handleDeleteExpense(expense.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-sm">
                        No hay registros.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}