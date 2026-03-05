// Punto de entrada de la app
// Envuelve todo en el AuthProvider



import './App.css'
import { AuthProvider } from './contexts/AuthContext'
import AppRoutes from './routes/AppRoutes'

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
