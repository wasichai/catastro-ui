# catastro-ui

Admin web de **catastro** (Perené) para [catastro-backend](../catastro-backend). Es el `WasichaiApp` de wasichai-ui
montado en `/`, con los módulos que catastro-backend usa (`views` y `gis`). No tiene portal.

|                     |                                                                |
| ------------------- | -------------------------------------------------------------- |
| Puerto              | 5181 (`yarn dev` y `yarn preview`)                             |
| API                 | proxy de `/api` a `http://localhost:8091` (`WASICHAI_API_URL`) |
| Login de desarrollo | `admin@wasichai.local` / `admin` (seed de catastro-backend)    |
| Claves del navegador | `localStorage['catastro.*']`                                  |

## Comandos

```
yarn install      # los @wasichai/* vienen de npm.pkg.github.com (ver .npmrc): hace falta un token read:packages
yarn dev
yarn lint
yarn typecheck
yarn test
yarn build
```

Los commits siguen conventional commits (commitlint, hook de husky).

## Despliegue: nginx y el WMS de GeoServer

La imagen sirve `dist/` con nginx, que hace de proxy de `/api` a catastro-backend y de `/geoserver/` a GeoServer
(los mapas piden las teselas WMS a este mismo origen). GeoServer sirve sin autenticación, así que no se expone: nginx
autoriza cada pedido con `GET /api/catastro/wms/autorizar` de catastro-backend (`auth_request`), que solo deja pasar las
capas de la organización del usuario. La configuración de nginx tiene una sola fuente, la plantilla
[`docs/deploy/nginx-catastro-ui.conf`](https://github.com/wasichai/catastro-backend/blob/main/docs/deploy/nginx-catastro-ui.conf)
de catastro-backend; su README («WMS protegido») explica el contrato.

MapLibre no manda cabeceras propias al pedir una tesela. Por eso cada mapa de esta app (`crearMapaBase`, en
`src/comun/mapa.ts`, que usan Aranceles y Brechas) tiene un `transformRequest` (`conToken`): agrega
`Authorization: Bearer <token>` (el `getToken()` de `@wasichai/core`) a las urls `/geoserver/` de este origen, y a
ninguna otra (las teselas de OSM, por ejemplo). Sin sesión, la tesela sale sin token y nginx responde 401. Va al final
de las opciones del mapa, así que ninguna página lo pisa.

El WMS protegido solo sirve lo que piden estos mapas: un `GetMap` ráster (`image/png`) de `/geoserver/catastro/wms`,
de las capas de la organización del usuario. Quien tenga una regla que le esconde filas o campos (filtro de dueño,
alcance, un campo que no lee) no recibe teselas (403): el visor de Brechas sigue mostrando los lotes desde la API, y las
capas WMS no aparecen dibujadas. Los detalles, en el README de catastro-backend.

**Limitación de `@wasichai/gis` 1.2.0:** su `MapView` crea el mapa sin `transformRequest` ni forma de pasárselo. La
vista previa WMS de `/gis/layers` no manda el token y sus teselas salen 401 (además pide la url de GeoServer tal como
la ve core, no la de este origen). `/gis/map` no pinta WMS: dibuja GeoJSON de la API y no se ve afectado.
`yarn dev` no hace proxy de `/geoserver/`: el WMS se prueba con la imagen de nginx.
