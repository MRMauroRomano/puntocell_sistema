
"use client"

import { useState, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, Trash2, MoreVertical, Save, Loader2, Edit2, FileUp, Hash, Printer, Sparkles, AlertTriangle } from "lucide-react"
import { Product } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import * as XLSX from 'xlsx'

const CATEGORIES = ["Celulares", "Audio", "Accesorios", "Computación", "Repuestos", "Otros"]

export default function ProductsPage() {
  const firestore = useFirestore()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [currentId, setCurrentId] = useState<string | null>(null)
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
      toast({
        variant: "destructive",
        title: "Campos incompletos",
        description: "El nombre es obligatorio.",
      })
      return
    }

    let finalCode = formProduct.code
    if (!finalCode || finalCode.trim() === "") {
      finalCode = Math.floor(1000 + Math.random() * 9000).toString()
    }

    setIsSaving(true)
    const productId = isEditing && currentId ? currentId : Math.random().toString(36).substr(2, 9)
    const productDocRef = doc(firestore, 'products', productId)
    
    const productData = {
      ...formProduct,
      code: finalCode,
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
        toast({ title: "Producto guardado" })
      }
      setIsDialogOpen(false)
    } catch (error) {
      toast({ variant: "destructive", title: "Error al guardar" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleGenerateMissingCodes = () => {
    if (!products || products.length === 0) {
      toast({ title: "Información", description: "No hay productos en el inventario para procesar." })
      return
    }

    let count = 0
    products.forEach(p => {
      const currentCode = String(p.code || "").trim()
      if (currentCode.length !== 4) {
        const newCode = Math.floor(1000 + Math.random() * 9000).toString()
        const productRef = doc(firestore, 'products', p.id)
        updateDocumentNonBlocking(productRef, { code: newCode })
        count++
      }
    })

    if (count > 0) {
      toast({ 
        title: "Códigos generados", 
        description: `Se han actualizado ${count} productos con nuevos códigos de 4 dígitos.` 
      })
    } else {
      toast({ 
        title: "Información", 
        description: "Todos los productos actuales ya poseen un código de 4 dígitos válido." 
      })
    }
  }

  const handleDeleteAll = () => {
    if (confirm("¿EstÁS COMPLETAMENTE SEGURO de eliminar TODOS los productos? Esta acción no se puede deshacer y borrará todo el catálogo actual.")) {
      if (!products || products.length === 0) return
      
      products.forEach(p => {
        const docRef = doc(firestore, 'products', p.id)
        deleteDocumentNonBlocking(docRef)
      })
      
      toast({
        title: "Inventario vaciado",
        description: "Se han eliminado todos los productos del sistema.",
      })
    }
  }

  const handlePrintInventory = () => {
    if (typeof window !== 'undefined') window.print()
  }

  const handleDeleteProduct = (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar ${name}?`)) {
      const docRef = doc(firestore, 'products', id)
      deleteDocumentNonBlocking(docRef)
      toast({ title: "Producto eliminado" })
    }
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
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

        if (jsonData.length === 0) {
          toast({
            variant: "destructive",
            title: "Archivo vacío",
            description: "No se encontraron datos en el archivo Excel.",
          })
          setIsImporting(false)
          return
        }

        let count = 0
        jsonData.forEach((row) => {
          const normalizedRow: any = {}
          Object.keys(row).forEach(key => {
            normalizedRow[key.toLowerCase().trim()] = row[key]
          })

          const name = normalizedRow.nombre || normalizedRow.name || normalizedRow.producto || normalizedRow.item || normalizedRow.modelo || ""
          const priceRaw = normalizedRow.precio || normalizedRow.price || normalizedRow.valor || "0"
          const price = parseFloat(String(priceRaw).replace(/[^0-9.-]+/g, "")) || 0
          const code = normalizedRow.codigo || normalizedRow.code || Math.floor(1000 + Math.random() * 9000).toString()

          if (name) {
            const productId = Math.random().toString(36).substr(2, 9)
            const productRef = doc(firestore, 'products', productId)
            
            const productData: Product = {
              id: productId,
              code: String(code).padStart(4, '0').slice(0, 4),
              name: String(name).trim(),
              price: price,
              category: normalizedRow.categoría || normalizedRow.categoria || normalizedRow.category || "Otros",
              subCategory: normalizedRow.marca || normalizedRow.brand || "",
              condition: String(normalizedRow.estado || "").toLowerCase().includes('usado') ? 'Usado' : 'Nuevo',
              stock: parseInt(String(normalizedRow.stock || "0")) || 0,
              minStock: parseInt(String(normalizedRow.minimo || "5")) || 5,
              isActive: true
            }

            setDocumentNonBlocking(productRef, productData, { merge: true })
            count++
          }
        })

        toast({
          title: "Importación finalizada",
          description: `Se han procesado ${count} productos correctamente.`,
        })
        setIsImportDialogOpen(false)
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error de importación",
          description: "No se pudo procesar el archivo.",
        })
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
          <h1 className="text-2xl lg:text-3xl font-bold font-headline text-primary">Inventario</h1>
          <p className="text-sm text-muted-foreground">Gestiona tus equipos con códigos de 4 dígitos.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" className="flex-1 sm:flex-none gap-2" onClick={handlePrintInventory}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>

          <Button variant="outline" className="flex-1 sm:flex-none gap-2" onClick={() => setIsImportDialogOpen(true)}>
            <FileUp className="h-4 w-4" /> Importar Excel
          </Button>

          <Button variant="destructive" className="flex-1 sm:flex-none gap-2" onClick={handleDeleteAll} disabled={!products || products.length === 0}>
            <Trash2 className="h-4 w-4" /> Vaciar Todo
          </Button>

          <Button className="flex-1 sm:flex-none gap-2 shadow-sm" onClick={handleOpenAdd}>
            <Plus className="h-4 w-4" /> Nuevo Producto
          </Button>
        </div>
      </div>

      <div className="print-only p-8 bg-white text-black">
        <div className="flex justify-between items-center mb-6 border-b-2 border-black pb-4">
          <div>
            <h1 className="text-2xl font-black uppercase">LISTADO DE INVENTARIO</h1>
            <p className="text-xs font-bold uppercase">Fecha: {new Date().toLocaleDateString('es-AR')}</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold font-headline text-primary">CommerceManager Pro</h2>
            <p className="text-xs">Control de Inventario</p>
          </div>
        </div>
        <Table className="border-black">
          <TableHeader className="bg-gray-100">
            <TableRow className="border-black">
              <TableHead className="text-black font-bold border-r border-black">Cód.</TableHead>
              <TableHead className="text-black font-bold border-r border-black">Producto</TableHead>
              <TableHead className="text-black font-bold border-r border-black text-center">Estado</TableHead>
              <TableHead className="text-black font-bold border-r border-black text-right">Precio</TableHead>
              <TableHead className="text-black font-bold text-center">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((product) => (
              <TableRow key={product.id} className="border-black">
                <TableCell className="font-mono text-xs border-r border-black">{product.code}</TableCell>
                <TableCell className="border-r border-black">
                  <div className="font-bold">{product.name}</div>
                  <div className="text-[10px] uppercase text-gray-500">{product.category} {product.subCategory && `| ${product.subCategory}`}</div>
                </TableCell>
                <TableCell className="text-center text-xs uppercase border-r border-black">{product.condition}</TableCell>
                <TableCell className="text-right font-bold border-r border-black">${product.price.toFixed(2)}</TableCell>
                <TableCell className="text-center font-bold">{product.stock}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Card className="shadow-sm border-primary/10 overflow-hidden no-print">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por código, nombre o marca..." 
                  className="pl-9 bg-muted/30 border-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-[180px] bg-muted/30 border-none">
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 gap-1 font-bold" onClick={handleGenerateMissingCodes}>
               <Sparkles className="h-4 w-4" /> Generar Códigos
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Cargando inventario...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-24">Código</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Categoría / Marca</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs font-bold bg-primary/5 border-primary/20">
                          {product.code || "----"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-sm">{product.name}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.condition === 'Nuevo' ? 'default' : 'secondary'} className="text-[10px] uppercase font-black">
                          {product.condition}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium text-muted-foreground">{product.category}</div>
                        <div className="text-[10px] text-primary font-bold uppercase">{product.subCategory}</div>
                      </TableCell>
                      <TableCell className="text-right font-black text-sm text-primary">${product.price.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <span className={product.stock < product.minStock ? "text-red-600 font-black text-base" : "text-sm"}>
                          {product.stock}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleOpenEdit(product); }}>
                              <Edit2 className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleDeleteProduct(product.id, product.name); }} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filtered.length === 0 && (
                <div className="text-center py-12 text-muted-foreground italic text-sm">
                  No se encontraron productos.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[525px] rounded-xl no-print">
          <DialogHeader>
            <DialogTitle className="text-xl font-headline">
              {isEditing ? "Editar Producto" : "Registrar Producto"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2 col-span-1">
                <Label htmlFor="code" className="flex items-center gap-1"><Hash className="h-3 w-3" /> Cód.</Label>
                <Input 
                  id="code" 
                  maxLength={4}
                  placeholder="Auto" 
                  value={formProduct.code}
                  onChange={(e) => setFormProduct({...formProduct, code: e.target.value.replace(/\D/g, '')})}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="name">Nombre / Modelo</Label>
                <Input 
                  id="name" 
                  placeholder="Ej: iPhone 15 Pro Max" 
                  value={formProduct.name}
                  onChange={(e) => setFormProduct({...formProduct, name: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={formProduct.category} onValueChange={(v) => setFormProduct({...formProduct, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input placeholder="Ej: Apple, Samsung" value={formProduct.subCategory} onChange={(e) => setFormProduct({...formProduct, subCategory: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={formProduct.condition} onValueChange={(v: any) => setFormProduct({...formProduct, condition: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Nuevo">Nuevo</SelectItem><SelectItem value="Usado">Usado</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Precio ($)</Label>
                <Input type="number" value={formProduct.price || ""} onChange={(e) => setFormProduct({...formProduct, price: Number(e.target.value)})} />
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
            <Button onClick={handleSaveProduct} className="w-full sm:w-auto gap-2" disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEditing ? "Actualizar" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="no-print">
          <DialogHeader>
            <DialogTitle>Importar desde Excel</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-sm text-muted-foreground">Sube tu archivo con las columnas <b>Nombre</b> y <b>Precio</b>.</p>
            <Input type="file" accept=".xlsx, .xls, .csv" onChange={handleImportExcel} disabled={isImporting} ref={fileInputRef} />
            {isImporting && (
              <div className="flex items-center justify-center gap-2 text-sm text-primary font-bold">
                <Loader2 className="h-4 w-4 animate-spin" /> Procesando...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
