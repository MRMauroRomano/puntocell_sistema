
"use client"

import { useState, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, Trash2, MoreVertical, Save, Loader2, Edit2, FileUp, Hash, Printer, Sparkles, Layers, CheckCircle2, Tag, ChevronRight, LayoutGrid } from "lucide-react"
import { Product } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from 'xlsx'
import { cn } from "@/lib/utils"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

const CATEGORIES = ["Celulares", "Audio", "Accesorios", "Computación", "Repuestos", "Otros"]

export default function ProductsPage() {
  const firestore = useFirestore()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const productsRef = useMemoFirebase(() => collection(firestore, 'products'), [firestore])
  const { data: products, isLoading } = useCollection<Product>(productsRef)

  const [formProduct, setFormProduct] = useState<Partial<Product>>({
    code: "",
    name: "",
    category: "Celulares",
    subCategory: "",
    condition: "Nuevo",
    price: 0,
    stock: 0,
    minStock: 5,
    description: ""
  })

  const [bulkData, setBulkData] = useState({
    actionType: 'price_percent',
    value: ''
  })

  const filtered = useMemo(() => {
    if (!products) return []
    return products.filter(p => {
      const matchesSearch = (
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.subCategory?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(p.code || "").includes(searchTerm)
      )
      const matchesCategory = selectedCategory === "all" || p.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [products, searchTerm, selectedCategory])

  const categoryCounts = useMemo(() => {
    if (!products) return {}
    const counts: Record<string, number> = { all: products.length }
    products.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1
    })
    return counts
  }, [products])

  const handleOpenAdd = () => {
    setIsEditing(false)
    setCurrentId(null)
    setFormProduct({
      code: "",
      name: "",
      category: "Celulares",
      subCategory: "",
      condition: "Nuevo",
      price: 0,
      stock: 0,
      minStock: 5,
      description: ""
    })
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (product: Product) => {
    setIsEditing(true)
    setCurrentId(product.id)
    setFormProduct({
      code: product.code || "",
      name: product.name,
      category: product.category,
      subCategory: product.subCategory || "",
      condition: product.condition || "Nuevo",
      price: product.price,
      stock: product.stock,
      minStock: product.minStock,
      description: product.description || ""
    })
    setIsDialogOpen(true)
  }

  const handleSaveProduct = () => {
    if (!formProduct.name) {
      toast({ variant: "destructive", title: "Campos incompletos", description: "El nombre es obligatorio." })
      return
    }

    setIsSaving(true)
    const productId = isEditing && currentId ? currentId : Math.random().toString(36).substr(2, 9)
    const productDocRef = doc(firestore, 'products', productId)
    
    const productData = {
      ...formProduct,
      price: Number(formProduct.price) || 0,
      stock: Number(formProduct.stock) || 0,
      minStock: Number(formProduct.minStock) || 0,
      isActive: true,
      id: productId
    } as Product

    try {
      if (isEditing) {
        updateDocumentNonBlocking(productDocRef, productData)
        toast({ title: "Producto actualizado" })
      } else {
        setDocumentNonBlocking(productDocRef, productData, { merge: true })
        toast({ title: "Producto registrado" })
      }
      setIsDialogOpen(false)
    } catch (error) {
      toast({ variant: "destructive", title: "Error al guardar" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleBulkUpdate = () => {
    if (selectedIds.length === 0 || !bulkData.value) return
    setIsSaving(true)
    try {
      selectedIds.forEach(id => {
        const product = products?.find(p => p.id === id)
        if (!product) return
        const productRef = doc(firestore, 'products', id)
        let update: any = {}
        if (bulkData.actionType === 'price_percent') {
          const percent = parseFloat(bulkData.value)
          const newPrice = product.price * (1 + percent / 100)
          update = { price: Number(newPrice.toFixed(2)) }
        } else if (bulkData.actionType === 'category') {
          update = { category: bulkData.value }
        } else if (bulkData.actionType === 'brand') {
          update = { subCategory: bulkData.value }
        }
        updateDocumentNonBlocking(productRef, update)
      })
      toast({ title: "Actualización completada", description: `Se modificaron ${selectedIds.length} productos.` })
      setIsBulkDialogOpen(false)
      setSelectedIds([])
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Ocurrió un error al actualizar." })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAll = () => {
    if (!products || products.length === 0) return
    products.forEach(p => {
      const docRef = doc(firestore, 'products', p.id)
      deleteDocumentNonBlocking(docRef)
    })
    toast({ title: "Inventario vaciado con éxito" })
  }

  const handlePrint = () => { if (typeof window !== 'undefined') window.print() }

  const handleGenerateCodes = () => {
    if (!products) return
    let count = 0
    products.forEach(p => {
      if (!p.code || p.code.length !== 4) {
        const newCode = Math.floor(1000 + Math.random() * 9000).toString()
        updateDocumentNonBlocking(doc(firestore, 'products', p.id), { code: newCode })
        count++
      }
    })
    toast({ title: count > 0 ? "Códigos generados" : "Sin cambios", description: `Se actualizaron ${count} productos.` })
  }

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[]
        
        jsonData.forEach(row => {
          const normalized = Object.keys(row).reduce((acc: any, key) => {
            acc[key.toLowerCase().trim()] = row[key];
            return acc;
          }, {});

          const name = normalized.nombre || normalized.name || normalized.producto || "";
          const price = parseFloat(String(normalized.precio || normalized.price || "0").replace(/[^0-9.-]+/g, "")) || 0;
          
          if (name) {
            const id = Math.random().toString(36).substr(2, 9)
            const code = normalized.codigo || normalized.code || Math.floor(1000 + Math.random() * 9000).toString()
            const pData: Product = {
              id,
              name: String(name),
              price,
              code: String(code).slice(0, 4),
              category: normalized.categoria || normalized.category || "Otros",
              subCategory: normalized.marca || normalized.brand || "",
              condition: 'Nuevo',
              stock: Number(normalized.stock) || 0,
              minStock: Number(normalized.minimo) || 5,
              isActive: true
            }
            setDocumentNonBlocking(doc(firestore, 'products', id), pData, { merge: true })
          }
        })
        toast({ title: "Importación finalizada" })
        setIsImportDialogOpen(false)
      } catch (err) {
        toast({ variant: "destructive", title: "Error al importar" })
      } finally {
        setIsImporting(false)
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold font-headline text-primary">Inventario</h1>
          <p className="text-sm text-muted-foreground">Gestión de stock y equipos por categoría.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button 
            variant="secondary" 
            className={cn("flex-1 sm:flex-none gap-2 bg-amber-50 text-amber-700 hover:bg-amber-100", selectedIds.length === 0 && "opacity-50")} 
            onClick={() => selectedIds.length > 0 && setIsBulkDialogOpen(true)}
            disabled={selectedIds.length === 0}
          >
            <Layers className="h-4 w-4" /> Masivo ({selectedIds.length})
          </Button>

          <Button variant="outline" className="flex-1 sm:flex-none gap-2" onClick={handlePrint}><Printer className="h-4 w-4" /> Imprimir</Button>
          <Button variant="outline" className="flex-1 sm:flex-none gap-2" onClick={() => setIsImportDialogOpen(true)}><FileUp className="h-4 w-4" /> Importar</Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="flex-1 sm:flex-none gap-2" disabled={!products || products.length === 0}>
                <Trash2 className="h-4 w-4" /> Vaciar Todo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Borrar todo el inventario?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción eliminará permanentemente todos los productos registrados. No se puede revertir.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Confirmar Eliminación
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button className="flex-1 sm:flex-none gap-2 shadow-sm" onClick={handleOpenAdd}><Plus className="h-4 w-4" /> Nuevo</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Menú de Categorías Lateral */}
        <Card className="lg:col-span-3 border-primary/10 shadow-sm no-print sticky top-6">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-primary flex items-center gap-2">
              <Tag className="h-4 w-4" /> Menú Categorías
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <nav className="flex flex-col gap-1">
              <Button 
                variant={selectedCategory === 'all' ? 'secondary' : 'ghost'} 
                className={cn(
                  "justify-between font-bold h-10 px-3",
                  selectedCategory === 'all' && "bg-primary/10 text-primary hover:bg-primary/20"
                )}
                onClick={() => setSelectedCategory('all')}
              >
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  <span>Todos los Productos</span>
                </div>
                <Badge variant="outline" className="h-5 min-w-5 justify-center font-mono">{categoryCounts.all || 0}</Badge>
              </Button>
              <div className="h-px bg-muted my-1" />
              {CATEGORIES.map(cat => (
                <Button 
                  key={cat}
                  variant={selectedCategory === cat ? 'secondary' : 'ghost'} 
                  className={cn(
                    "justify-between font-medium h-10 px-3",
                    selectedCategory === cat && "bg-primary/10 text-primary hover:bg-primary/20"
                  )}
                  onClick={() => setSelectedCategory(cat)}
                >
                  <div className="flex items-center gap-2">
                    <ChevronRight className={cn("h-3 w-3 transition-transform", selectedCategory === cat ? "rotate-90 text-primary" : "text-muted-foreground")} />
                    <span>{cat}</span>
                  </div>
                  <Badge variant="outline" className="h-5 min-w-5 justify-center font-mono bg-white">{categoryCounts[cat] || 0}</Badge>
                </Button>
              ))}
            </nav>
          </CardContent>
        </Card>

        {/* Tabla de Productos y Filtros */}
        <Card className="lg:col-span-9 shadow-sm border-primary/10 overflow-hidden no-print">
          <CardHeader className="pb-4 border-b bg-muted/10">
            <div className="flex flex-col md:flex-row gap-4 justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por código, nombre o marca..." 
                  className="pl-9 bg-white border-primary/20 focus-visible:ring-primary" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
              <Button variant="ghost" size="sm" className="text-primary gap-1 font-bold h-10" onClick={handleGenerateCodes}>
                <Sparkles className="h-4 w-4" /> Generar Códigos
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-20 text-center flex flex-col items-center gap-2">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
                <p className="text-sm text-muted-foreground font-medium">Sincronizando inventario...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox 
                          checked={selectedIds.length === filtered.length && filtered.length > 0} 
                          onCheckedChange={() => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map(p => p.id))} 
                        />
                      </TableHead>
                      <TableHead className="w-24">Cód.</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-center">Stock</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((product) => (
                      <TableRow key={product.id} className={cn("hover:bg-primary/5 transition-colors", selectedIds.includes(product.id) && "bg-primary/5")}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedIds.includes(product.id)} 
                            onCheckedChange={() => setSelectedIds(prev => prev.includes(product.id) ? prev.filter(i => i !== product.id) : [...prev, product.id])} 
                          />
                        </TableCell>
                        <TableCell><Badge variant="outline" className="font-mono text-xs font-bold border-primary/20">{product.code || "----"}</Badge></TableCell>
                        <TableCell>
                          <div className="font-bold text-sm">{product.name}</div>
                          <div className="text-[10px] text-muted-foreground uppercase font-black">{product.category} • {product.subCategory}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.condition === 'Nuevo' ? 'default' : 'secondary'} className="text-[10px] uppercase font-black">
                            {product.condition}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-black text-sm text-primary">
                          ${product.price.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={product.stock < product.minStock ? "destructive" : "outline"} 
                            className={cn("font-bold min-w-[30px] justify-center", product.stock < product.minStock ? "animate-pulse" : "")}
                          >
                            {product.stock}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => handleOpenEdit(product)}>
                                <Edit2 className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => { if(confirm("¿Eliminar producto?")) deleteDocumentNonBlocking(doc(firestore, 'products', product.id)) }} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-20">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Tag className="h-10 w-10 opacity-20" />
                            <p className="text-sm italic">No se encontraron productos en esta categoría.</p>
                          </div>
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

      {/* Vista de Impresión */}
      <div className="print-only p-8 bg-white text-black">
        <div className="flex justify-between items-end mb-6 border-b-2 border-black pb-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">LISTADO DE INVENTARIO</h1>
            <p className="text-xs font-bold uppercase text-gray-600">Categoría: {selectedCategory === 'all' ? 'TODAS' : selectedCategory}</p>
          </div>
          <p className="text-xs font-bold">Fecha: {new Date().toLocaleDateString('es-AR')}</p>
        </div>
        <Table className="border-black">
          <TableHeader>
            <TableRow className="border-black bg-gray-100">
              <TableHead className="text-black font-black uppercase text-[10px]">Cód.</TableHead>
              <TableHead className="text-black font-black uppercase text-[10px]">Producto / Categoría</TableHead>
              <TableHead className="text-black font-black uppercase text-[10px] text-right">Precio</TableHead>
              <TableHead className="text-black font-black uppercase text-[10px] text-center">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(p => (
              <TableRow key={p.id} className="border-black">
                <TableCell className="font-mono text-xs font-bold">{p.code}</TableCell>
                <TableCell>
                  <div className="font-black text-sm uppercase">{p.name}</div>
                  <div className="text-[9px] font-bold text-gray-500 uppercase">{p.category} - {p.subCategory}</div>
                </TableCell>
                <TableCell className="text-right font-black font-mono text-sm">${p.price.toFixed(2)}</TableCell>
                <TableCell className="text-center font-black text-sm">{p.stock}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Diálogos */}
      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Modificación Masiva</DialogTitle>
            <DialogDescription>Aplicar cambios a {selectedIds.length} productos seleccionados.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Acción a Realizar</Label>
              <Select value={bulkData.actionType} onValueChange={(v) => setBulkData({...bulkData, actionType: v, value: ''})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="price_percent">Actualizar Precio (%)</SelectItem>
                  <SelectItem value="category">Cambiar Categoría</SelectItem>
                  <SelectItem value="brand">Cambiar Marca/Subcat.</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nuevo Valor / Porcentaje</Label>
              <Input 
                value={bulkData.value} 
                onChange={(e) => setBulkData({...bulkData, value: e.target.value})} 
                placeholder={bulkData.actionType === 'price_percent' ? "Ej: 15 para un 15% de aumento" : "Nuevo valor..."} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleBulkUpdate} disabled={isSaving} className="w-full gap-2">
              {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} 
              Aplicar Cambios Masivos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[500px] rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-headline">{isEditing ? "Editar" : "Nuevo"} Producto</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1 space-y-1">
                <Label>Código</Label>
                <Input 
                  value={formProduct.code} 
                  maxLength={4} 
                  placeholder="0000"
                  className="font-mono text-center"
                  onChange={e => setFormProduct({...formProduct, code: e.target.value.replace(/\D/g, '')})} 
                />
              </div>
              <div className="col-span-3 space-y-1">
                <Label>Nombre del Equipo / Producto</Label>
                <Input value={formProduct.name} placeholder="Ej: iPhone 15 Pro Max" onChange={e => setFormProduct({...formProduct, name: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Categoría</Label>
                <Select value={formProduct.category} onValueChange={v => setFormProduct({...formProduct, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Marca / Sub-categoría</Label>
                <Input value={formProduct.subCategory} placeholder="Ej: Apple" onChange={e => setFormProduct({...formProduct, subCategory: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Precio ($)</Label>
                <Input type="number" value={formProduct.price || ""} onChange={e => setFormProduct({...formProduct, price: Number(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <Label>Stock Actual</Label>
                <Input type="number" value={formProduct.stock || ""} onChange={e => setFormProduct({...formProduct, stock: Number(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <Label>Aviso Mínimo</Label>
                <Input type="number" value={formProduct.minStock || ""} onChange={e => setFormProduct({...formProduct, minStock: Number(e.target.value)})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveProduct} disabled={isSaving} className="w-full gap-2">
              {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />} 
              {isEditing ? "Actualizar Equipo" : "Registrar Equipo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Inventario desde Excel</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg text-xs space-y-2">
              <p className="font-bold text-primary uppercase flex items-center gap-2"><FileUp className="h-3 w-3" /> Instrucciones:</p>
              <p>El sistema reconocerá automáticamente columnas llamadas <b>Nombre</b> (o Producto) y <b>Precio</b>.</p>
              <p>Si incluyes una columna <b>Stock</b> o <b>Categoría</b>, también se cargarán.</p>
            </div>
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportExcel} disabled={isImporting} ref={fileInputRef} />
            {isImporting && <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="animate-spin h-6 w-6 text-primary" />
              <p className="text-xs text-muted-foreground animate-pulse">Procesando archivo...</p>
            </div>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
