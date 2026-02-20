
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, Trash2, MoreVertical, Save, Loader2, AlertCircle, Edit2 } from "lucide-react"
import { Product } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"

export default function ProductsPage() {
  const firestore = useFirestore()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [currentId, setCurrentId] = useState<string | null>(null)

  const productsRef = useMemoFirebase(() => collection(firestore, 'products'), [firestore])
  const { data: products, isLoading } = useCollection<Product>(productsRef)

  const [formProduct, setFormProduct] = useState<Partial<Product>>({
    name: "",
    category: "Nuevo",
    subCategory: "",
    price: 0,
    stock: 0,
    minStock: 5,
    description: ""
  })

  const filtered = useMemo(() => {
    if (!products) return []
    return products.filter(p => {
      const matchesSearch = (p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           p.subCategory?.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchesCategory = selectedCategory === "all" || p.category === selectedCategory
      
      return matchesSearch && matchesCategory
    })
  }, [products, searchTerm, selectedCategory])

  const handleOpenAdd = () => {
    setIsEditing(false)
    setCurrentId(null)
    setFormProduct({
      name: "",
      category: "Nuevo",
      subCategory: "",
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
      name: product.name,
      category: product.category,
      subCategory: product.subCategory || "",
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
        description: "El nombre/modelo es obligatorio.",
      })
      return
    }

    setIsSaving(true)
    
    const productId = isEditing && currentId ? currentId : Math.random().toString(36).substr(2, 9)
    const productDocRef = doc(firestore, 'products', productId)
    
    const priceVal = Number(formProduct.price)
    const stockVal = Number(formProduct.stock)
    const minStockVal = Number(formProduct.minStock)

    if (isNaN(priceVal) || isNaN(stockVal) || isNaN(minStockVal)) {
      setIsSaving(false)
      toast({
        variant: "destructive",
        title: "Valores inválidos",
        description: "El precio y stock deben ser números válidos.",
      })
      return
    }

    const productData = {
      name: formProduct.name,
      category: formProduct.category || "Nuevo",
      subCategory: formProduct.subCategory || "",
      price: priceVal,
      stock: stockVal,
      minStock: minStockVal,
      description: formProduct.description || "",
      isActive: true,
      id: productId
    }

    try {
      if (isEditing) {
        updateDocumentNonBlocking(productDocRef, productData)
        toast({
          title: "Producto actualizado",
          description: `${formProduct.name} se ha actualizado correctamente.`,
        })
      } else {
        setDocumentNonBlocking(productDocRef, productData, { merge: true })
        toast({
          title: "Producto guardado",
          description: `${formProduct.name} se ha registrado correctamente.`,
        })
      }
      
      setIsDialogOpen(false)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error de sistema",
        description: "No se pudo procesar la solicitud de guardado.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteProduct = (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar ${name}?`)) {
      const docRef = doc(firestore, 'products', id)
      deleteDocumentNonBlocking(docRef)
      toast({
        title: "Producto eliminado",
        description: `${name} ha sido borrado del inventario.`,
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl lg:text-3xl font-bold font-headline text-primary">Inventario</h1>
          <p className="text-sm text-muted-foreground">Administra tus equipos y repuestos electrónicos.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto gap-2 shadow-sm" onClick={handleOpenAdd}>
              <Plus className="h-4 w-4" /> Nuevo Producto
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] sm:max-w-[525px] rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-headline">
                {isEditing ? "Editar Equipo" : "Registrar Equipo"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre / Modelo</Label>
                <Input 
                  id="name" 
                  placeholder="Ej: iPhone 15 Pro" 
                  value={formProduct.name}
                  onChange={(e) => setFormProduct({...formProduct, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Estado / Categoría</Label>
                  <Select 
                    value={formProduct.category} 
                    onValueChange={(v) => setFormProduct({...formProduct, category: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Nuevo">Nuevo</SelectItem>
                      <SelectItem value="Usado">Usado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subCategory">Marca / Marca Repuesto</Label>
                  <Input 
                    id="subCategory" 
                    placeholder="Ej: Apple, Samsung..." 
                    value={formProduct.subCategory}
                    onChange={(e) => setFormProduct({...formProduct, subCategory: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Precio Venta</Label>
                  <Input 
                    id="price" 
                    type="number" 
                    placeholder="0.00" 
                    value={formProduct.price || ""}
                    onChange={(e) => setFormProduct({...formProduct, price: Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Stock Inicial</Label>
                  <Input 
                    id="stock" 
                    type="number" 
                    placeholder="0" 
                    value={formProduct.stock || ""}
                    onChange={(e) => setFormProduct({...formProduct, stock: Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minStock">Aviso Stock</Label>
                  <Input 
                    id="minStock" 
                    type="number" 
                    placeholder="5" 
                    value={formProduct.minStock || ""}
                    onChange={(e) => setFormProduct({...formProduct, minStock: Number(e.target.value)})}
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
              <Button onClick={handleSaveProduct} className="w-full sm:w-auto gap-2" disabled={isSaving} type="button">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isEditing ? "Guardar Cambios" : "Guardar Producto"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-sm border-primary/10 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar equipo o marca..." 
                className="pl-9 bg-muted/30 border-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-[180px] bg-muted/30 border-none">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Nuevo">Nuevos</SelectItem>
                <SelectItem value="Usado">Usados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Cargando base de datos...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {filtered.length === 0 ? (
                <div className="text-center py-20">
                  <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-20" />
                  <p className="text-muted-foreground">No se encontraron productos.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="min-w-[150px]">Modelo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-center">Stock</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium text-sm">{product.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <Badge variant={product.category === 'Nuevo' ? 'default' : 'secondary'} className="w-fit text-[10px] uppercase">
                              {product.category}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{product.subCategory}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-sm">${product.price.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <span className={product.stock < product.minStock ? "text-red-600 font-bold" : "text-sm"}>
                            {product.stock}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenEdit(product)}>
                                <Edit2 className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteProduct(product.id, product.name)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
