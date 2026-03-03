
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileText, Save, Info, Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { BillingConfig } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

const DEFAULT_CONFIGS: BillingConfig[] = [
  { id: 'config-1', name: '', cuit: '', description: 'Entidad Principal' },
  { id: 'config-2', name: '', cuit: '', description: 'Entidad Secundaria' },
]

export default function SettingsPage() {
  const firestore = useFirestore()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  
  const settingsRef = useMemoFirebase(() => collection(firestore, 'settings'), [firestore])
  const { data: remoteConfigs, isLoading } = useCollection<BillingConfig>(settingsRef)
  
  const [localConfigs, setLocalConfigs] = useState<BillingConfig[]>(DEFAULT_CONFIGS)

  // Sincronizar con datos de Firebase al cargar
  useEffect(() => {
    if (remoteConfigs && remoteConfigs.length > 0) {
      // Mapear los datos remotos para asegurar que config-1 y config-2 estén presentes
      const merged = DEFAULT_CONFIGS.map(def => {
        const found = remoteConfigs.find(r => r.id === def.id)
        return found || def
      })
      setLocalConfigs(merged)
    }
  }, [remoteConfigs])

  const handleUpdate = (id: string, field: string, value: string) => {
    setLocalConfigs(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const handleSaveAll = () => {
    setIsSaving(true)
    
    try {
      localConfigs.forEach(config => {
        const configDocRef = doc(firestore, 'settings', config.id)
        setDocumentNonBlocking(configDocRef, config, { merge: true })
      })
      
      toast({
        title: "Configuración guardada",
        description: "Los datos de facturación se han actualizado correctamente.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron guardar los cambios.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Cargando configuración...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold font-headline">Configuración del Sistema</h1>
        <p className="text-muted-foreground">Gestiona los datos de facturación y parámetros generales de tu tienda.</p>
      </div>

      <Alert className="bg-primary/5 border-primary/20">
        <Info className="h-4 w-4 text-primary" />
        <AlertTitle className="text-primary font-bold">Información de Facturación</AlertTitle>
        <AlertDescription>
          Puedes configurar hasta dos razones sociales distintas para emitir comprobantes. 
          Al realizar una venta, podrás seleccionar cuál utilizar según el producto o categoría.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        {localConfigs.map((config, index) => (
          <Card key={config.id} className="border-primary/10 overflow-hidden">
            <CardHeader className="flex flex-row items-center gap-4 bg-muted/30">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Entidad de Facturación {index + 1}</CardTitle>
                <CardDescription>Configuración de CUIT y Razón Social.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`name-${config.id}`}>Nombre / Razón Social</Label>
                  <Input 
                    id={`name-${config.id}`}
                    value={config.name}
                    placeholder="Ej: Mi Empresa S.R.L."
                    onChange={(e) => handleUpdate(config.id, 'name', e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`cuit-${config.id}`}>Número de CUIT</Label>
                  <Input 
                    id={`cuit-${config.id}`}
                    placeholder="XX-XXXXXXXX-X"
                    value={config.cuit}
                    onChange={(e) => handleUpdate(config.id, 'cuit', e.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`desc-${config.id}`}>Descripción Interna (Opcional)</Label>
                <Input 
                  id={`desc-${config.id}`}
                  placeholder="Ej: Solo para accesorios, Monotributo, etc."
                  value={config.description || ""}
                  onChange={(e) => handleUpdate(config.id, 'description', e.target.value)}
                  disabled={isSaving}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end pt-4">
        <Button 
          className="gap-2 h-12 px-8 font-bold text-lg shadow-lg" 
          onClick={handleSaveAll}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Guardar Todos los Cambios
        </Button>
      </div>
    </div>
  )
}
