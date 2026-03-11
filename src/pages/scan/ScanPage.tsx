import React, { useState, useEffect, useRef } from 'react'
import QrScanner from 'qr-scanner'
// worker path required by the library (copied to public folder by Vite)
QrScanner.WORKER_PATH = '/qr-scanner-worker.min.js'
import { useAuth } from '../../hooks/useAuth'
import { useVisits } from '../../hooks/useVisits'
import { createAccessLog } from '../../services/logs.service'
import type { Visit } from '../../types/index'

// Esta pantalla está pensada para que un guardia o administrador
// lea / escriba el token QR y registre la entrada del visitante.
// A diferencia de otras páginas, la información principal viene
// del hook useVisits y se actualiza en memoria tras cada cambio.

const ScanPage: React.FC = () => {
  const { user, role } = useAuth()
  const { visits, changeStatus, refresh } = useVisits()

  const [token, setToken] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scannedVisit, setScannedVisit] = useState<Visit | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [isWorking, setIsWorking] = useState(false)
  const [newStatus, setNewStatus] = useState<Visit['status']>('pending')
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const qrScannerRef = useRef<QrScanner | null>(null)

  // tokens rápidos (hasta 3 primeros pendientes)
  const pendingTokens = visits.filter((v) => v.status === 'pending').slice(0, 3)



  // funciones de cámara
  const startCameraScan = async () => {
    // video element is rendered always (but may be hidden), so ref should exist now
    if (!videoRef.current) {
      setCameraError('Elemento de video no disponible, recarga la página.')
      return
    }

    // algunos navegadores en Windows requieren https/secure context
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Navegador no soporta acceso a cámara.')
      return
    }

    try {
      setCameraError(null)
      // no usamos "scanning" aquí para no bloquear el botón de detener

      // solicitar permiso explícito antes de inicializar QrScanner
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      videoRef.current.srcObject = stream
      // algunos navegadores requieren play explícito
      await videoRef.current.play()

      const qrScanner = new QrScanner(
        videoRef.current,
        (result) => {
          // Solo llenar el token en el input, no procesar aún
          setToken(result.data.trim())
          stopCameraScan()
        },
        {
          onDecodeError: (err) => console.log('decode error', err),
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      )

      qrScannerRef.current = qrScanner
      await qrScanner.start()
      console.log('QR Scanner started successfully')
      setCameraActive(true)
    } catch (err: any) {
      console.error('Error iniciando cámara', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Permiso denegado para usar la cámara.')
      } else if (err.name === 'NotFoundError') {
        setCameraError('No se encontró dispositivo de video.')
      } else {
        setCameraError('No se pudo acceder a la cámara. Asegura que la página esté en HTTPS y prueba de nuevo.')
      }
    }
  }

  const stopCameraScan = () => {
    console.log('Stopping camera scan')
    if (qrScannerRef.current) {
      qrScannerRef.current.stop()
      qrScannerRef.current.destroy()
      qrScannerRef.current = null
    }
    setCameraActive(false)
    setScanning(false)
  }

  const doScan = () => {
    setScanError(null)
    setScannedVisit(null)
    setActionMessage(null)

    if (scanning) return
    setScanning(true)

    setTimeout(() => {
      const lookup = token.trim() || pendingTokens[0]?.qr_token || ''
      const found = visits.find((v) => v.qr_token === lookup)

      if (!found) {
        setScanError('Token no encontrado.')
      } else if (found.status !== 'pending' && role !== 'admin') {
        // security only handles pending visits, admin can proceed anyway
        setScanError(
          found.status === 'approved'
            ? 'Visita aún no completada.'
            : `Acceso ${found.status}.`
        )
      } else {
        setScannedVisit(found)
      }
      setScanning(false)
    }, 1400)
  }

  const handleRegister = async () => {
    if (!scannedVisit || !user) return
    setIsWorking(true)
    try {
      // admin may pick a different status stored in newStatus
      const statusToSet = role === 'admin' ? newStatus : 'completed'
      const updated = await changeStatus(scannedVisit.id, statusToSet)
      if (statusToSet === 'completed') {
        await createAccessLog(scannedVisit.id, user.id)
      }
      setActionMessage('Estado actualizado correctamente.')
      // recargar tokens rápidos
      await refresh()
      // if admin changed it, update local object so dropdown stays in sync
      setScannedVisit(updated)
    } catch (err) {
      console.error(err)
      setActionMessage('Error al registrar la entrada.')
    } finally {
      setIsWorking(false)
    }
  }

  useEffect(() => {
    // cuando se detecta una visita, inicializar el dropdown de estatus
    if (scannedVisit) {
      setNewStatus(scannedVisit.status)
    }
  }, [scannedVisit])

  useEffect(() => {
    // Cleanup al desmontar
    return () => {
      stopCameraScan()
    }
  }, [])

  useEffect(() => {
    // si el usuario no tiene permiso redirigirlo en un futuro
    // por ahora simplemente no hacemos nada
  }, [role])

  return (
    <div style={{ backgroundColor: '#080c0f', minHeight: '100vh', padding: 20, color: '#ffffff' }}>
      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        <h1 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 10 }}>Escanear QR</h1>
        <p style={{ color: '#a0a0a0', marginBottom: 30 }}>Verifica el acceso del visitante.</p>

        {/* área de cámara */}
        <div style={{
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 20,
          overflow: 'hidden',
          position: 'relative',
          aspectRatio: '1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16
        }}>
          <video
          ref={videoRef}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: cameraActive ? 'block' : 'none'
          }}
          playsInline
          muted
        />
        </div>

        {/* Controles de cámara */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button
            onClick={cameraActive ? stopCameraScan : startCameraScan}
            className="btn-primary"
            style={{ flex: 1, padding: '8px 16px', fontSize: 12 }}
          >
            {cameraActive ? 'Detener cámara' : 'Iniciar cámara'}
          </button>
        </div>

        {cameraError && (
          <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#431212', borderRadius: 8 }}>
            <p style={{ margin: 0, color: '#f87171', fontSize: 13 }}>{cameraError}</p>
          </div>
        )}

        {/* entrada manual y tokens rapidos */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="TKN-XXXXXXXX"
            className="input"
            style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
            onKeyDown={(e) => { if (e.key === 'Enter') doScan() }}
          />
          <button
            onClick={doScan}
            disabled={scanning}
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: 12 }}
          >
            {scanning ? '...' : 'Scan'}
          </button>
        </div>

        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {pendingTokens.map((v) => (
            <button
              key={v.id}
              onClick={() => setToken(v.qr_token)}
              className="btn-secondary"
              style={{ fontFamily: 'monospace', fontSize: 11, padding: '4px 8px' }}
            >
              {v.qr_token}
            </button>
          ))}
        </div>

        {/* mensaje de error o de acción */}
        {scanError && (
          <div style={{ marginTop: 16, padding: 12, backgroundColor: '#431212', borderRadius: 8 }}>
            <p style={{ margin: 0, color: '#f87171', fontSize: 13 }}>{scanError}</p>
          </div>
        )}
        {actionMessage && (
          <div style={{ marginTop: 16, padding: 12, backgroundColor: '#0f371c', borderRadius: 8 }}>
            <p style={{ margin: 0, color: '#6ee7b7', fontSize: 13 }}>{actionMessage}</p>
          </div>
        )}

        {/* detalle de visita encontrada */}
        {scannedVisit && (
          <div style={{
            background: '#0f172a',
            border: '1px solid #166534',
            borderRadius: 20,
            padding: 20,
            marginTop: 20
          }}>
            <h4 style={{ color: '#22d3ee', marginBottom: 12 }}>Datos del visitante</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>Nombre</span>
              <span style={{ color: '#fff', fontWeight: 500, fontSize: 13 }}>{scannedVisit.visitor_name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>Teléfono</span>
              <span style={{ color: '#fff', fontWeight: 500, fontSize: 13 }}>{scannedVisit.visitor_phone || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>Fecha</span>
              <span style={{ color: '#fff', fontWeight: 500, fontSize: 13 }}>{scannedVisit.visit_date} · {scannedVisit.visit_time}</span>
            </div>

            {role === 'admin' && (
              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'block', color: '#94a3b8', marginBottom: 6 }}>Nuevo estado</label>
                <select
                  aria-label="Nuevo estado"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as Visit['status'])}
                  className="input"
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: 13 }}
                >
                  {['pending','approved','rejected','completed','cancelled'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              id="approve-btn"
              onClick={handleRegister}
              disabled={isWorking}
              className="btn-primary"
              style={{ width: '100%', marginTop: 12 }}
            >
              {isWorking ? '...' : role === 'admin' ? 'Actualizar estado' : '✓ Registrar entrada'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ScanPage
