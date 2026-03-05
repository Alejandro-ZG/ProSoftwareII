// Todas la rutas de la app

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import  ProtectedRoute from './ProtectedRoute.tsx'
import { useAuth } from '../context/AuthContext'

// - Pages

import LoginPage from '../pages/auth/Login'

export default function AppRoutes() {
    const { user } = useAuth()
    return (
        <BrowserRouter>
            <Routes>
                {/* Raíz: redirigir a login o dashboard según sesión */}
                <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />

                {/* Rutas públicas */}
                <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
            </Routes>
        </BrowserRouter>
    )
}