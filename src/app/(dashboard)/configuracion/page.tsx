
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileText, Save, Info, Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, useUser } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { BillingConfig } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

const DEFAULT_CONFIGS: BillingConfig[] = [
  { id: 'config-1', name: '', cuit: '', description: 'Mi Tienda Principal' },
  { id: 'config-2', name: '', cuit: '', description: 'Tienda Secundaria' },
]

export default function SettingsPage() {
  const firestore = useFirestore()
  const { user } = useUser()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  
  const settingsRef = useMemoFirebase(() => 
    user ? collection(firestore, 'users', user.uid, 'settings') : null, 
  [firestore, user])
  const { data: remoteConfigs, isLoading } = useCollection<BillingConfig>(settingsRef)
  
  const [localConfigs, setLocalConfigs] = useState<BillingConfig[]>(DEFAULT_CONFIGS)

  useEffect(() => {
    if (remoteConfigs && remoteConfigs.length > 0) {
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
    if (!user) return
    setIsSaving(true)
    
    try {
      localConfigs.forEach(config => {
        const configDocRef = doc(firestore, 'users', user.uid, 'settings', config.id)
        setDocumentNonBlocking(configDocRef, config, { merge: true })
      })
      
      toast({
        title: "Configuración guardada",
        description: "Los datos de tu tienda se han actualizado.",
      })
    } catch (error) {
      toast({ variant: "destructive", title: "Error al guardar" })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div className="p-20 text-center"><Loader2 className="animate-spin inline" /></div>

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold font-headline">Ajustes de mi Tienda</h1>

      <Alert className="bg-primary/5 border-primary/20">
        <Info className="h-4 w-4" />
        <AlertTitle>Configuración Personal</AlertTitle>
        <AlertDescription>
          Estos datos son exclusivos de tu cuenta y se usarán en tus comprobantes.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        {localConfigs.map((config, index) => (
          <Card key={config.id} className="border-primary/10">
            <CardHeader className="bg-muted/30">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" /> Entidad {index + 1}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Razón Social / Nombre Comercial</Label>
                  <Input 
                    value={config.name}
                    onChange={(e) => handleUpdate(config.id, 'name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CUIT</Label>
                  <Input 
                    value={config.cuit}
                    onChange={(e) => handleUpdate(config.id, 'cuit', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSaveAll} disabled={isSaving}>
          {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
          Guardar Cambios de mi Tienda
        </Button>
      </div>
    </div>
  )
}
