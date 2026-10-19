import { defineConfig } from 'eslint/config'
import obsidianmd from 'eslint-plugin-obsidianmd'

// The rules Obsidian's plugin review runs, type-checked against tsconfig.json.
export default defineConfig([
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
])
