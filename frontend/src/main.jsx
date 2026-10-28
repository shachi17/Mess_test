import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// StrictMode removed: in dev it mounts twice and the camera scanner renders twice.
createRoot(document.getElementById('root')).render(<App />)
