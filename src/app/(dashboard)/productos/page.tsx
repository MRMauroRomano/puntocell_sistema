
"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Plus, Edit, Trash2, Package, Filter, MoreVertical, AlertCircle, Tag, Save, Loader2 } from "lucide-react"
import { Product } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase"
import { collection, doc } from "firebase/firestore"

export default function ProductsPage() {
  const firestore = useFirestore()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  // Firebase connection
  const productsRef = useMemoFirebase(() => collection(firestore, 'products'), [firestore])
  const { data: products, isLoading } = useCollection<Product>(productsRef)

  // State for new product form
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: "",
    sku: "",
    category: "Celulares",
    subCategory: "",
    price: 0,
    stock: 0,
    minStock: 5,
    description: ""
  })

  const categories = useMemo(() => {
    if (!products) return ["all"]
    const cats = Array.from(new Set(products.map(p => p.category))).filter(Boolean)
    return ["all", ...cats]
  }, [products])

  const filtered = useMemo(() => {
    if (!products) return []
    return products.filter(p => {
      const matchesSearch = (p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           p.subCategory?.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchesCategory = selectedCategory === "all" || p.category === selectedCategory
      
      return matchesSearch && matchesCategory
    })
  }, [products, searchTerm, selectedCategory])

  const handleAddProduct = () => {
    if (!newProduct.name || !newProduct.sku) return

    const productId = Math.random().toString(36).substr(2, 9)
    const productDocRef = doc(firestore, 'products', productId)
    
    const productData = {
      name: newProduct.name,
      sku: newProduct.sku,
      category: newProduct.category || "General",
      subCategory: newProduct.subCategory || "",
      price: Number(newProduct.price) || 0,
      stock: Number(newProduct.stock) || 0,
      minStock: Number(newProduct.minStock) || 5,
      description: newProduct.description || "",
      isActive: true,
      id: productId
    }

    // Usar setDocumentNonBlocking para guardar en Firestore
    setDocumentNonBlocking(productDocRef, productData, { merge: true })
    
    setIsAddDialogOpen(false)
    setNewProduct({
      name: "",
      sku: "",
      category: "Celulares",
      subCategory: "",
      price: 0,
      stock: 0,
      minStock: 5,
      description: ""
    })
  }

  const handleDeleteProduct = (id: string) => {
    const docRef = doc(firestore, 'products', id)
    deleteDocumentNonBlocking(docRef)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold font-headline text-primary">Inventario de Equipos</h1>
          <p className="text-muted-foreground">Administra tus celulares, tablets y accesorios electrónicos.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" /> Nuevo Producto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-headline">Registrar Equipo</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre / Modelo</Label>
                  <Input 
                    id="name" 
                    placeholder="Ej: iPhone 15 Pro" 
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU / IMEI</Label>
                  <Input 
                    id="sku" 
                    placeholder="IMEI o Código" 
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Categoría</Label>
                  <Select 
                    value={newProduct.category} 
                    onValueChange={(v) => setNewProduct({...newProduct, category: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Celulares">Celulares</SelectItem>
                      <SelectItem value="Tablets">Tablets</SelectItem>
                      <SelectItem value="Audio">Audio</SelectItem>
                      <SelectItem value="Accesorios">Accesorios</SelectItem>
                      <SelectItem value="Repuestos">Repuestos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subCategory">Marca</Label>
                  <Input 
                    id="subCategory" 
                    placeholder="Ej: Apple, Samsung..." 
                    value={newProduct.subCategory}
                    onChange={(e) => setNewProduct({...newProduct, subCategory: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Precio Venta</Label>
                  <Input 
                    id="price" 
                    type="number" 
                    placeholder="0.00" 
                    value={newProduct.price || ""}
                    onChange={(e) => setNewProduct({...newProduct, price: Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Stock</Label>
                  <Input 
                    id="stock" 
                    type="number" 
                    placeholder="0" 
                    value={newProduct.stock || ""}
                    onChange={(e) => setNewProduct({...newProduct, stock: Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minStock">Aviso Stock</Label>
                  <Input 
                    id="minStock" 
                    type="number" 
                    placeholder="5" 
                    value={newProduct.minStock || ""}
                    onChange={(e) => setNewProduct({...newProduct, minStock: Number(e.target.value)})}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleAddProduct} className="gap-2">
                <Save className="h-4 w-4" /> Guardar Producto
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-sm border-primary/10">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex flex-1 gap-2 w-full">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar equipo o marca..." 
                  className="pl-9 bg-muted/30 border-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Cargando base de datos...</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>SKU/IMEI</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">${product.price.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <span className={product.stock < product.minStock ? "text-red-600 font-bold" : ""}>
                          {product.stock}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDeleteProduct(product.id)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
