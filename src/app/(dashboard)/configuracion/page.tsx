
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileText, Save, Info } from "lucide-react"
import { MOCK_BILLING_CONFIGS } from "@/lib/mock-data"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function SettingsPage() {
  const [configs, setConfigs] = useState(MOCK_BILLING_CONFIGS)

  const handleUpdate = (id: string, field: string, value: string) => {
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
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
        {configs.map((config, index) => (
          <Card key={config.id} className="border-primary/10">
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
                    onChange={(e) => handleUpdate(config.id, 'name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`cuit-${config.id}`}>Número de CUIT</Label>
                  <Input 
                    id={`cuit-${config.id}`}
                    placeholder="XX-XXXXXXXX-X"
                    value={config.cuit}
                    onChange={(e) => handleUpdate(config.id, 'cuit', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`desc-${config.id}`}>Descripción Interna (Opcional)</Label>
                <Input 
                  id={`desc-${config.id}`}
                  placeholder="Ej: Solo para accesorios, Monotributo, etc."
                  value={config.description}
                  onChange={(e) => handleUpdate(config.id, 'description', e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="bg-muted/10 justify-end py-3">
               <Button className="gap-2">
                 <Save className="h-4 w-4" /> Guardar Cambios
               </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
