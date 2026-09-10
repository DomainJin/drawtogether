import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

// Chạy code app trong node mà không cần Vite: xem env-shim-loader.mjs.
register('./env-shim-loader.mjs', pathToFileURL('./test/'))
