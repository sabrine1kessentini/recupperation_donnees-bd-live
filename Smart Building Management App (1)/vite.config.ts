import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      // Alias @ to the src directory
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
      // Force all imports of three and web-ifc to use the single root version
      {
        find: 'three',
        replacement: path.resolve(__dirname, './node_modules/three'),
      },
      {
        find: 'web-ifc',
        replacement: path.resolve(__dirname, './node_modules/web-ifc'),
      },
      {
        find: 'three-shims/BufferGeometryUtils',
        replacement: path.resolve(__dirname, './src/three-shims/BufferGeometryUtils.js'),
      },
    ],
  },
  define: {
  global: "window",
},

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv', '**/*.wasm'],
})
