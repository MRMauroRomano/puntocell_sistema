
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
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useUser } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from 'xlsx'
import { cn } from "@/lib/utils"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

const CATEGORIES = ["Celulares", "Audio", "Accesorios", "Computación", "Repuestos", "Otros"]

export default function ProductsPage() {
  const firestore = useFirestore()
  const { user } = useUser()
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

  const productsRef = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'products') : null, 
  [firestore, user])
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
    if (!user || !formProduct.name) {
      toast({ variant: "destructive", title: "Campos incompletos", description: "El nombre es obligatorio." })
      return
    }

    setIsSaving(true)
    const productId = isEditing && currentId ? currentId : Math.random().toString(36).substr(2, 9)
    const productDocRef = doc(firestore, 'users', user.uid, 'products', productId)
    
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
    if (!user || selectedIds.length === 0 || !bulkData.value) return
    setIsSaving(true)
    try {
      selectedIds.forEach(id => {
        const product = products?.find(p => p.id === id)
        if (!product) return
        const productRef = doc(firestore, 'users', user.uid, 'products', id)
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
    if (!user || !products || products.length === 0) return
    products.forEach(p => {
      const docRef = doc(firestore, 'users', user.uid, 'products', p.id)
      deleteDocumentNonBlocking(docRef)
    })
    toast({ title: "Inventario vaciado con éxito" })
  }

  const handlePrint = () => { if (typeof window !== 'undefined') window.print() }

  const handleGenerateCodes = () => {
    if (!user || !products) return
    let count = 0
    products.forEach(p => {
      if (!p.code || p.code.length !== 4) {
        const newCode = Math.floor(1000 + Math.random() * 9000).toString()
        updateDocumentNonBlocking(doc(firestore, 'users', user.uid, 'products', p.id), { code: newCode })
        count++
      }
    })
    toast({ title: count > 0 ? "Códigos generados" : "Sin cambios", description: `Se actualizaron ${count} productos.` })
  }

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return
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
        
        if (jsonData.length === 0) {
          toast({ variant: "destructive", title: "Archivo vacío", description: "No se encontraron datos en el Excel." })
          setIsImporting(false)
          return
        }

        let importedCount = 0
        jsonData.forEach(row => {
          // Normalizar nombres de columnas a minúsculas para mejor detección
          const normalized = Object.keys(row).reduce((acc: any, key) => {
            acc[key.toLowerCase().trim()] = row[key];
            return acc;
          }, {});

          const name = normalized.nombre || normalized.name || normalized.producto || normalized.description || normalized.descripcion || "";
          
          if (name) {
            const id = Math.random().toString(36).substr(2, 9)
            const code = normalized.codigo || normalized.code || Math.floor(1000 + Math.random() * 9000).toString()
            const price = parseFloat(String(normalized.precio || normalized.price || "0").replace(/[^0-9.-]+/g, "")) || 0;
            const stock = Number(normalized.stock || normalized.cantidad || normalized.quantity) || 0;
            const category = normalized.categoria || normalized.category || "Otros";
            const subCategory = normalized.marca || normalized.brand || normalized.subcategoria || "";

            const pData: Product = {
              id,
              name: String(name),
              price,
              code: String(code).slice(0, 4),
              category: String(category),
              subCategory: String(subCategory),
              condition: 'Nuevo',
              stock,
              minStock: Number(normalized.minimo || normalized.min) || 5,
              isActive: true
            }
            
            const productRef = doc(firestore, 'users', user.uid, 'products', id)
            setDocumentNonBlocking(productRef, pData, { merge: true })
            importedCount++
          }
        })
        
        toast({ title: "Importación finalizada", description: `Se cargaron ${importedCount} productos.` })
        setIsImportDialogOpen(false)
      } catch (err) {
        console.error("Error importando:", err)
        toast({ variant: "destructive", title: "Error al importar", description: "Verifica el formato del archivo." })
      } finally {
        setIsImporting(false)
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    }
    
    reader.onerror = () => {
      toast({ variant: "destructive", title: "Error de lectura", description: "No se pudo leer el archivo." })
      setIsImporting(false)
    }
    
    reader.readAsArrayBuffer(file)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold font-headline text-primary">Mi Inventario</h1>
          <p className="text-sm text-muted-foreground">Gestión de stock de tu tienda.</p>
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
          
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleImportExcel} 
          />
          <Button variant="outline" className="flex-1 sm:flex-none gap-2" onClick={() => fileInputRef.current?.click()}>
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} 
            Importar
          </Button>
          
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
                  Esta acción eliminará permanentemente todos los productos registrados en TU TIENDA. No se puede revertir.
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
              <Tag className="h-4 w-4" /> Categorías
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
                  <span>Todos</span>
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

        {/* Tabla de Productos */}
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
                <Sparkles className="h-4 w-4" /> Códigos Automáticos
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-20 text-center flex flex-col items-center gap-2">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
                <p className="text-sm text-muted-foreground font-medium">Cargando inventario de tu tienda...</p>
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
                              <DropdownMenuItem onSelect={() => { if(confirm("¿Eliminar producto?")) deleteDocumentNonBlocking(doc(firestore, 'users', user?.uid!, 'products', product.id)) }} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Diálogos */}
      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Modificación Masiva</DialogTitle>
            <DialogDescription>Cambios para {selectedIds.length} productos seleccionados.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Acción</Label>
              <Select value={bulkData.actionType} onValueChange={(v) => setBulkData({...bulkData, actionType: v, value: ''})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="price_percent">Actualizar Precio (%)</SelectItem>
                  <SelectItem value="category">Cambiar Categoría</SelectItem>
                  <SelectItem value="brand">Cambiar Marca</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input 
                value={bulkData.value} 
                onChange={(e) => setBulkData({...bulkData, value: e.target.value})} 
                placeholder="Nuevo valor o porcentaje..." 
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleBulkUpdate} disabled={isSaving} className="w-full gap-2">
              {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} 
              Aplicar Cambios
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
                  className="font-mono text-center"
                  onChange={e => setFormProduct({...formProduct, code: e.target.value.replace(/\D/g, '')})} 
                />
              </div>
              <div className="col-span-3 space-y-1">
                <Label>Nombre</Label>
                <Input value={formProduct.name} onChange={e => setFormProduct({...formProduct, name: e.target.value})} />
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
                <Label>Marca</Label>
                <Input value={formProduct.subCategory} onChange={e => setFormProduct({...formProduct, subCategory: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Precio</Label>
                <Input type="number" value={formProduct.price || ""} onChange={e => setFormProduct({...formProduct, price: Number(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <Label>Stock</Label>
                <Input type="number" value={formProduct.stock || ""} onChange={e => setFormProduct({...formProduct, stock: Number(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <Label>Mínimo</Label>
                <Input type="number" value={formProduct.minStock || ""} onChange={e => setFormProduct({...formProduct, minStock: Number(e.target.value)})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveProduct} disabled={isSaving} className="w-full gap-2">
              {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />} 
              Guardar en mi Tienda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
