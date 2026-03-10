# TechStore Manager - Guía de Despliegue

Este proyecto es una aplicación de Next.js gestionada para tiendas de tecnología y reparaciones.

## Cómo Publicar tu Web (Firebase App Hosting)

Para que tu aplicación sea accesible desde internet, sigue estos pasos:

### 1. Requisito de Plan
Firebase App Hosting requiere que tu proyecto esté en el **Plan Blaze (Pay-as-you-go)**. 
* **Nota:** Firebase ofrece una cuota gratuita generosa dentro del plan Blaze. Si tu uso es bajo, es probable que el costo sea $0, pero la tarjeta es necesaria para habilitar los servicios de Google Cloud.

### 2. Pasos en la Consola de Firebase
1. Ve a [Firebase Console](https://console.firebase.google.com/).
2. Selecciona tu proyecto: `studio-2933333639-3967d`.
3. En el menú de la izquierda, busca **Build > App Hosting**.
4. Haz clic en **"Get Started"**.
5. Conecta tu cuenta de GitHub (si el código está allí) o sigue las instrucciones para vincular este repositorio.
6. El sistema detectará automáticamente que es una aplicación de Next.js y realizará el despliegue.

### 3. Configuración de Base de Datos
Asegúrate de que Firestore esté habilitado en modo producción y que las reglas de seguridad (`firestore.rules`) estén desplegadas para que la app pueda leer y escribir datos de forma segura.

### 4. Dominio
Una vez desplegado, Firebase te proporcionará una URL similar a `https://tu-proyecto.web.app`. Puedes vincular un dominio propio desde la pestaña "Settings" de App Hosting.

---
*Desarrollado con Firebase Studio.*
