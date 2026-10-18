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
