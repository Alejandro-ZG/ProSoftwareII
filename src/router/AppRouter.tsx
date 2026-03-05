// Todas la rutas de la app

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
imoort  ProtectedRoute from './ProtectedRoute'
import { useAuth } from '../contexts/AuthContext'

// - Pages

import LoginPage from '../pages/Auth/Login'

export default function AppRoutes() {
    const { user } = useAuth()
    return (
        <BrowserRouter>
            <Routes>

                {/* Rutas públicas */}
                <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
            </Routes>
        </BrowserRouter>
    )
}