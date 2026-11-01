import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { enhanceSelects } from './lib/enhanceSelects.js'
import { enhanceSearch } from './lib/enhanceSearch.js'

const queryClient = new QueryClient()

// Styled dropdown lists and expanding search fields (see src/lib/enhance*.js).
enhanceSelects()
enhanceSearch()

createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
)
