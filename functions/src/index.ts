// @ts-ignore
import {onRequest} from "firebase-functions/v2/https";
// @ts-ignore
import * as logger from "firebase-functions/logger";

export const helloWorld = onRequest((req, res) => {
  res.send("¡Despliegue forzado exitoso!");
});
