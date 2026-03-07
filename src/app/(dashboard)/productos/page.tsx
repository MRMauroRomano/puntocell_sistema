
"use client"

import { useState, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, Trash2, MoreVertical, Save, Loader2, Edit2, FileUp, Hash, Printer, Sparkles, Layers, CheckCircle2, Tag, ChevronRight, LayoutGrid, Smartphone, Battery, Info } from "lucide-react"
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

const CATEGORIES = ["Celulares", "Fundas", "Audio", "Accesorios", "Computación", "Repuestos", "Otros"]

export default function ProductsPage() {
  const firestore = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
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
    description: "",
    batteryHealth: "",
    storage: ""
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
      description: "",
      batteryHealth: "",
      storage: ""
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
      description: product.description || "",
      batteryHealth: product.batteryHealth || "",
      storage: product.storage || ""
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
      code: formProduct.code || Math.floor(1000 + Math.random() * 9000).toString(),
      subCategory: formProduct.subCategory || "",
      description: formProduct.description || "",
      isActive: true,
      id: productId,
      condition: formProduct.condition || "Nuevo",
      batteryHealth: formProduct.category === 'Celulares' ? (formProduct.batteryHealth || "") : "",
      storage: formProduct.category === 'Celulares' ? (formProduct.storage || "") : ""
    }

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
    if (!user || selectedIds.length === 0 || !bulkData.value) {
      toast({
        variant: "destructive",
        title: "Faltan datos",
        description: "Selecciona productos y define un valor para actualizar."
      })
      return
    }

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
        } else if (bulkData.actionType === 'price_fixed') {
          update = { price: Number(bulkData.value) }
        } else if (bulkData.actionType === 'category') {
          update = { category: bulkData.value }
        }
        
        updateDocumentNonBlocking(productRef, update)
      })
      
      toast({ 
        title: "Actualización completada", 
        description: `Se modificaron ${selectedIds.length} productos correctamente.` 
      })
      setIsBulkDialogOpen(false)
      setSelectedIds([])
      setBulkData({ actionType: 'price_percent', value: '' })
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Ocurrió un error al actualizar masivamente." })
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
        
        let importedCount = 0
        jsonData.forEach(row => {
          const normalized = Object.keys(row).reduce((acc: any, key) => {
            acc[key.toLowerCase().trim()] = row[key];
            return acc;
          }, {});

          const name = normalized.nombre || normalized.name || normalized.producto || "";
          if (name) {
            const id = Math.random().toString(36).substr(2, 9)
            const price = parseFloat(String(normalized.precio || normalized.price || "0").replace(/[^0-9.-]+/g, "")) || 0
            const stock = Number(normalized.stock || normalized.cantidad || 0)

            const pData = {
              id,
              name: String(name),
              price,
              code: String(normalized.codigo || normalized.code || Math.floor(1000 + Math.random() * 9000)).slice(0, 4),
              category: String(normalized.categoria || normalized.category || "Otros"),
              subCategory: String(normalized.marca || normalized.brand || ""),
              condition: String(normalized.condicion || normalized.condition || "Nuevo"),
              stock,
              minStock: Number(normalized.minimo || 5),
              isActive: true,
              batteryHealth: normalized.bateria || normalized.battery || "",
              storage: normalized.memoria || normalized.storage || normalized.gb || ""
            }
            
            const productRef = doc(firestore, 'users', user.uid, 'products', id)
            setDocumentNonBlocking(productRef, pData, { merge: true })
            importedCount++
          }
        })
        
        toast({ title: "Importación finalizada", description: `Se cargaron ${importedCount} productos.` })
      } catch (err) {
        toast({ variant: "destructive", title: "Error al importar" })
      } finally {
        setIsImporting(false)
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filtered.map(p => p.id))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold font-headline text-primary">Mi Inventario</h1>
          <p className="text-sm text-muted-foreground">Gestión de stock y precios.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button 
            variant="default"
            className={cn("flex-1 sm:flex-none gap-2 bg-amber-500 hover:bg-amber-600 text-white shadow-lg transition-all", selectedIds.length === 0 && "opacity-50 grayscale cursor-not-allowed")} 
            onClick={() => selectedIds.length > 0 && setIsBulkDialogOpen(true)}
            disabled={selectedIds.length === 0}
          >
            <Layers className="h-4 w-4" /> Modificación Masiva ({selectedIds.length})
          </Button>

          <Button variant="outline" className="flex-1 sm:flex-none gap-2" onClick={handlePrint}><Printer className="h-4 w-4" /> Imprimir</Button>
          
          <input type="file" className="hidden" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx, .xls" />
          <Button variant="outline" className="flex-1 sm:flex-none gap-2" onClick={() => fileInputRef.current?.click()}>
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Importar
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
                <AlertDialogDescription>Esta acción eliminará todos los productos registrados. No se puede deshacer.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-white hover:bg-destructive/90">Confirmar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button className="flex-1 sm:flex-none gap-2 shadow-md" onClick={handleOpenAdd}><Plus className="h-4 w-4" /> Nuevo</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <Card className="lg:col-span-3 border-primary/10 shadow-sm no-print sticky top-6">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-primary flex items-center gap-2"><Tag className="h-4 w-4" /> Categorías</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <nav className="flex flex-col gap-1">
              <Button 
                variant={selectedCategory === 'all' ? 'secondary' : 'ghost'} 
                className={cn("justify-between font-bold h-10 px-3", selectedCategory === 'all' && "bg-primary/10 text-primary")}
                onClick={() => setSelectedCategory('all')}
              >
                <div className="flex items-center gap-2"><LayoutGrid className="h-4 w-4" /><span>Todos</span></div>
                <Badge variant="outline" className="h-5 min-w-5 justify-center bg-white">{categoryCounts.all || 0}</Badge>
              </Button>
              {CATEGORIES.map(cat => (
                <Button 
                  key={cat}
                  variant={selectedCategory === cat ? 'secondary' : 'ghost'} 
                  className={cn("justify-between font-medium h-10 px-3", selectedCategory === cat && "bg-primary/10 text-primary")}
                  onClick={() => setSelectedCategory(cat)}
                >
                  <div className="flex items-center gap-2"><ChevronRight className={cn("h-3 w-3 transition-transform", selectedCategory === cat && "rotate-90")} /><span>{cat}</span></div>
                  <Badge variant="outline" className="h-5 min-w-5 justify-center bg-white">{categoryCounts[cat] || 0}</Badge>
                </Button>
              ))}
            </nav>
          </CardContent>
        </Card>

        <Card className="lg:col-span-9 shadow-sm border-primary/10 overflow-hidden">
          <CardHeader className="pb-4 border-b bg-muted/10">
            <div className="flex flex-col md:flex-row gap-4 justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por código o nombre..." 
                  className="pl-9 bg-white" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
              <Button variant="ghost" size="sm" className="text-primary gap-1 font-bold no-print" onClick={handleGenerateCodes}>
                <Sparkles className="h-4 w-4" /> Generar Códigos
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-20 text-center flex flex-col items-center gap-2">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
                <p className="text-sm text-muted-foreground">Cargando inventario...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-12 no-print">
                        <Checkbox 
                          checked={selectedIds.length === filtered.length && filtered.length > 0} 
                          onCheckedChange={toggleSelectAll} 
                        />
                      </TableHead>
                      <TableHead className="w-24">Cód.</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-center">Stock</TableHead>
                      <TableHead className="text-right no-print">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((product) => (
                      <TableRow key={product.id} className={cn(selectedIds.includes(product.id) && "bg-primary/5")}>
                        <TableCell className="no-print">
                          <Checkbox 
                            checked={selectedIds.includes(product.id)} 
                            onCheckedChange={() => setSelectedIds(prev => prev.includes(product.id) ? prev.filter(i => i !== product.id) : [...prev, product.id])} 
                          />
                        </TableCell>
                        <TableCell><Badge variant="outline" className="font-mono text-xs font-bold">{product.code || "----"}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{product.name}</span>
                            <Badge variant={product.condition === 'Nuevo' ? 'default' : 'secondary'} className="text-[9px] h-4 font-black uppercase">
                              {product.condition}
                            </Badge>
                          </div>
                          <div className="text-[10px] text-muted-foreground uppercase font-black">
                            {product.category} • {product.subCategory}
                            {product.category === 'Celulares' && product.storage && ` • ${product.storage}`}
                            {product.category === 'Celulares' && product.batteryHealth && ` • Bat: ${product.batteryHealth}`}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-black text-sm text-primary">${product.price.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={product.stock < product.minStock ? "destructive" : "outline"} className="font-bold">{product.stock}</Badge>
                        </TableCell>
                        <TableCell className="text-right no-print">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenEdit(product)}><Edit2 className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { if(confirm("¿Eliminar?")) deleteDocumentNonBlocking(doc(firestore, 'users', user?.uid!, 'products', product.id)) }} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Eliminar</DropdownMenuItem>
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

      {/* Diálogo de Modificación Masiva */}
      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-amber-600" />
              Modificación Masiva
            </DialogTitle>
            <DialogDescription>
              Estás modificando <strong>{selectedIds.length}</strong> productos seleccionados.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>¿Qué quieres cambiar?</Label>
              <Select value={bulkData.actionType} onValueChange={(v) => setBulkData({...bulkData, actionType: v, value: ''})}>
                <SelectTrigger className="bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price_percent">Aumentar Precio (%)</SelectItem>
                  <SelectItem value="price_fixed">Asignar Precio Fijo ($)</SelectItem>
                  <SelectItem value="category">Cambiar Categoría</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Nuevo Valor</Label>
              {bulkData.actionType === 'category' ? (
                <Select value={bulkData.value} onValueChange={(v) => setBulkData({...bulkData, value: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="relative">
                  {bulkData.actionType === 'price_percent' ? (
                    <span className="absolute right-3 top-2.5 text-muted-foreground font-bold">%</span>
                  ) : (
                    <span className="absolute left-3 top-2.5 text-muted-foreground font-bold">$</span>
                  )}
                  <Input 
                    type="number"
                    className={cn(bulkData.actionType === 'price_percent' ? "pr-8" : "pl-8")}
                    value={bulkData.value} 
                    onChange={(e) => setBulkData({...bulkData, value: e.target.value})} 
                    placeholder={bulkData.actionType === 'price_percent' ? "Ej: 15" : "Ej: 1200.50"} 
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => setIsBulkDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button 
              onClick={handleBulkUpdate} 
              disabled={isSaving || !bulkData.value} 
              className="w-full bg-amber-600 hover:bg-amber-700"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Aplicar a {selectedIds.length} productos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Producto Individual */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[550px] rounded-xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl font-headline flex items-center gap-2">
              {isEditing ? <Edit2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              {isEditing ? "Editar" : "Nuevo"} Producto
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1 space-y-1">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Código</Label>
                <Input value={formProduct.code} maxLength={4} className="font-mono text-center font-bold" onChange={e => setFormProduct({...formProduct, code: e.target.value.replace(/\D/g, '')})} />
              </div>
              <div className="col-span-3 space-y-1">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Nombre del Producto</Label>
                <Input value={formProduct.name} placeholder="Ej: iPhone 13 Pro Max" onChange={e => setFormProduct({...formProduct, name: e.target.value})} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Categoría</Label>
                <Select value={formProduct.category} onValueChange={v => setFormProduct({...formProduct, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Marca / Modelo</Label>
                <Input value={formProduct.subCategory} placeholder="Ej: Apple" onChange={e => setFormProduct({...formProduct, subCategory: e.target.value})} />
              </div>
            </div>

            {formProduct.category === 'Celulares' && (
              <div className="space-y-3 p-4 bg-primary/5 rounded-xl border-2 border-primary/10">
                <div className="flex items-center gap-2 text-primary mb-2">
                  <Smartphone className="h-4 w-4" />
                  <span className="text-xs font-black uppercase tracking-wider">Especificaciones de Celular</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase flex items-center gap-1"><Info className="h-3 w-3" /> Estado / Subcat.</Label>
                    <Select value={formProduct.condition} onValueChange={v => setFormProduct({...formProduct, condition: v as any})}>
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Nuevo">Celular Nuevo</SelectItem>
                        <SelectItem value="Usado">Celular Usado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase flex items-center gap-1"><Smartphone className="h-3 w-3" /> Memoria (GB)</Label>
                    <Input 
                      placeholder="Ej: 128GB" 
                      className="bg-white"
                      value={formProduct.storage} 
                      onChange={e => setFormProduct({...formProduct, storage: e.target.value})} 
                    />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase flex items-center gap-1"><Battery className="h-3 w-3" /> Salud de Batería (%)</Label>
                  <Input 
                    placeholder="Ej: 100% o 85%" 
                    className="bg-white"
                    value={formProduct.batteryHealth} 
                    onChange={e => setFormProduct({...formProduct, batteryHealth: e.target.value})} 
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Precio ($)</Label>
                <Input type="number" className="font-bold text-primary" value={formProduct.price} onChange={e => setFormProduct({...formProduct, price: Number(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Stock Act.</Label>
                <Input type="number" value={formProduct.stock} onChange={e => setFormProduct({...formProduct, stock: Number(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Aviso Mín.</Label>
                <Input type="number" value={formProduct.minStock} onChange={e => setFormProduct({...formProduct, minStock: Number(e.target.value)})} />
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4 border-t mt-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">Cancelar</Button>
            <Button onClick={handleSaveProduct} disabled={isSaving} className="flex-1 gap-2 shadow-lg">
              {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />} 
              {isEditing ? "Actualizar" : "Guardar"} Producto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
