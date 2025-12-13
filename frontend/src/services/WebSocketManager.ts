/**
 * UNITNAVE Designer - WebSocket Manager (V2.0) - UPDATED (Stable)
 * Cliente WebSocket con URL configurable para Railway
 *
 * Cambios aplicados:
 * - URL correcta: /ws/layout/{sessionId}
 * - Normaliza baseUrl: http->ws, https->wss, quita /realtime y barras finales
 * - Protocolo consistente: action + snake_case y ts (no timestamp)
 * - client_id llega del backend en evento type:"connected"
 * - Buffer de mensajes entrantes (INBOX) hasta que exista storeUpdater
 * - maxInbox reducido para evitar freeze en reconexión
 *
 * @version 2.1
 */

// ============================================================
// TYPES
// ============================================================

export interface WSMessage {
  action?: string
  type?: string
  [key: string]: any
}

export type MessageHandler = (data: WSMessage) => void
export type StoreUpdater = (data: WSMessage) => void

// ============================================================
// CONFIGURATION
// ============================================================

const DEFAULT_CONFIG = {
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  reconnectMultiplier: 1.5,
  maxReconnectAttempts: 10,

  heartbeatInterval: 30000,
  heartbeatTimeout: 5000,

  // outbox queue
  messageQueueSize: 200,

  // inbox buffer (bajado para evitar freeze al reconectar)
  maxInbox: 50,

  // rate limit envío
  rateLimitMs: 33
}

// ============================================================
// HELPERS
// ============================================================

function safeJsonParse(raw: string): any | null {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, '')
}

function normalizeWsBaseUrl(input: string): string {
  // Acepta:
  // - ws://localhost:8000
  // - wss://xxx.up.railway.app
  // - http(s)://... -> lo convierte a ws(s)
  // - y también si viene con /realtime, lo elimina
  let s = (input || '').trim()

  if (s.startsWith('https://')) s = 'wss://' + s.slice('https://'.length)
  if (s.startsWith('http://')) s = 'ws://' + s.slice('http://'.length)

  s = stripTrailingSlash(s)

  if (s.endsWith('/realtime')) {
    s = s.slice(0, -'/realtime'.length)
    s = stripTrailingSlash(s)
  }

  return s
}

// ============================================================
// WEBSOCKET MANAGER CLASS
// ============================================================

class WebSocketManager {
  private ws: WebSocket | null = null
  private sessionId: string | null = null
  private userName: string = 'Anónimo'
  private baseUrl: string = ''
  private config = { ...DEFAULT_CONFIG }

  // Reconexión
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts: number = 0
  private currentReconnectDelay: number = DEFAULT_CONFIG.reconnectDelay

  // Heartbeat
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null
  private lastPongTime: number = Date.now()

  // Cola de mensajes (OUTBOX)
  private messageQueue: WSMessage[] = []

  // Buffer de mensajes entrantes (INBOX) hasta que exista storeUpdater
  private inbox: WSMessage[] = []

  // Rate limiting
  private lastMessageTime: number = 0

  // Event handlers
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map()
  private globalHandlers: Set<MessageHandler> = new Set()

  // Store updater callback
  private storeUpdater: StoreUpdater | null = null
  private onConnectedCallback: (() => void) | null = null
  private onDisconnectedCallback: (() => void) | null = null
  private onReconnectingCallback: ((attempt: number) => void) | null = null

  // Identidad asignada por backend
  private clientId: string | null = null

  // ============================================================
  // STORE CALLBACK REGISTRATION
  // ============================================================

  setStoreUpdater(updater: StoreUpdater): void {
    this.storeUpdater = updater
    this._flushInbox()
  }

  setOnConnected(callback: () => void): void {
    this.onConnectedCallback = callback
  }

  setOnDisconnected(callback: () => void): void {
    this.onDisconnectedCallback = callback
  }

  setOnReconnecting(callback: (attempt: number) => void): void {
    this.onReconnectingCallback = callback
  }

  getClientId(): string | null {
    return this.clientId
  }

  // ============================================================
  // CONEXIÓN - ACEPTA URL PERSONALIZADA
  // ============================================================

  /**
   * Conectar al WebSocket
   * @param sessionId - ID de sesión único
   * @param userName - Nombre del usuario
   * @param customBaseUrl - URL base del backend (ej: wss://tu-backend.railway.app)
   */
  connect(sessionId: string, userName: string = 'Anónimo', customBaseUrl?: string): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      console.warn('⚠️ WebSocket ya está conectado/conectando')
      return
    }

    this.sessionId = sessionId
    this.userName = userName || 'Anónimo'

    this.reconnectAttempts = 0
    this.currentReconnectDelay = this.config.reconnectDelay

    // Determinar URL base
    if (customBaseUrl) {
      this.baseUrl = normalizeWsBaseUrl(customBaseUrl)
    } else {
      // Fallback: usar window.location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      this.baseUrl = normalizeWsBaseUrl(`${protocol}//${host}`)
    }

    console.log('🔗 WebSocket baseUrl configurada:', this.baseUrl)

    this._createConnection()
  }

  private _buildWsUrl(): string {
    if (!this.sessionId) throw new Error('No hay sessionId')
    const base = stripTrailingSlash(this.baseUrl)

    // ✅ IMPORTANTE: tu backend es /ws/layout/{session_id}
    return `${base}/ws/layout/${encodeURIComponent(this.sessionId)}?user=${encodeURIComponent(this.userName)}`
  }

  private _createConnection(): void {
    console.log('🎯 ===== INICIO DEL HANDSHAKE WEBSOCKET =====')
    console.log('🎯 SessionId:', this.sessionId)
    console.log('🎯 UserName:', this.userName)
    console.log('🎯 BaseUrl:', this.baseUrl)

    if (!this.sessionId) {
      console.error('❌ No hay sessionId')
      return
    }

    const wsUrl = this._buildWsUrl()
    console.log('🎯 URL completa:', wsUrl)

    // Log de entorno del navegador
    console.log('🎯 Navegador - Origin:', window.location.origin)
    console.log('🎯 Navegador - Protocol:', window.location.protocol)
    console.log('🎯 Navegador - Host:', window.location.host)

    console.log('🎯 Creando instancia WebSocket...')

    try {
      this.ws = new WebSocket(wsUrl)
      console.log('🎯 WebSocket instanciado (estado:', this.ws.readyState, ')')

      // Listeners (única fuente de verdad)
      this.ws.onopen = (e) => {
        console.log('✅ EVENTO ONOPEN:', e)
        this._handleOpen()
      }

      this.ws.onmessage = (e) => {
        // OJO: esto puede ser muy ruidoso, pero lo mantengo porque tú lo querías
        // console.log('📨 EVENTO ONMESSAGE:', e.data)
        this._handleMessage(e)
      }

      this.ws.onclose = (e) => {
        console.log('🔌 EVENTO ONCLOSE:', e.code, e.reason)
        this._handleClose(e)
      }

      this.ws.onerror = (e: Event) => {
        console.error('❌ EVENTO ONERROR:', e)

        const eventAny = e as any
        if (eventAny.target) {
          console.error('❌ - target.url:', eventAny.target.url)
          console.error('❌ - target.readyState:', eventAny.target.readyState)
        } else {
          console.error('❌ - target NO DISPONIBLE')
        }

        console.error('❌ - type:', e.type)
        console.error('❌ - isTrusted:', (e as any).isTrusted)

        this._handleError(e)
      }

      console.log('🎯 Listeners asignados correctamente')
    } catch (error) {
      console.error('❌ ERROR CRÍTICO EN catch():', error)
      this._scheduleReconnect()
    }
  }

  // ============================================================
  // EVENT HANDLERS
  // ============================================================

  private _handleOpen(): void {
    console.log('✅ WebSocket conectado (socket abierto)')

    // ❗ NO disparamos onConnectedCallback aquí
    // porque el "connected" real lo manda el backend con client_id.
    this.reconnectAttempts = 0
    this.currentReconnectDelay = this.config.reconnectDelay

    this._startHeartbeat()
    this._flushMessageQueue()

    // Evento local opcional
    this._emit('socket_open', { session_id: this.sessionId, ts: Date.now() })
  }

  private _handleMessage(event: MessageEvent): void {
    const data: WSMessage | null =
      typeof event.data === 'string' ? safeJsonParse(event.data) : (event.data as any)

    if (!data) return

    // heartbeat
    if (data.type === 'pong') {
      this.lastPongTime = Date.now()
      this._clearHeartbeatTimeout()
      return
    }

    // ✅ Capturar clientId del backend en el primer connected
    if (data.type === 'connected' && data.client_id) {
      this.clientId = String(data.client_id)
      this.onConnectedCallback?.()
    }

    // Store updater (si no existe aún, buffer INBOX)
    if (this.storeUpdater) {
      this.storeUpdater(data)
    } else {
      this.inbox.push(data)
      if (this.inbox.length > this.config.maxInbox) this.inbox.shift()
    }

    // Emit por type o action
    if (data.type) this._emit(data.type, data)
    if (data.action) this._emit(data.action, data)

    // Global handlers
    this.globalHandlers.forEach((handler) => handler(data))
  }

  private _handleClose(event: CloseEvent): void {
    console.log(`🔌 WebSocket cerrado: ${event.code} - ${event.reason}`)

    this._stopHeartbeat()
    this._emit('disconnected', { code: event.code, reason: event.reason, ts: Date.now() })

    this.onDisconnectedCallback?.()

    // Reconectar solo si no fue cierre manual (1000)
    if (event.code !== 1000) {
      this._scheduleReconnect()
    }
  }

  private _handleError(event: Event): void {
    console.error('❌ WebSocket error:', event)
    this._emit('error', { error: event, ts: Date.now() })
  }

  // ============================================================
  // INBOX
  // ============================================================

  private _flushInbox(): void {
    if (!this.storeUpdater) return
    const buffered = [...this.inbox]
    this.inbox = []
    buffered.forEach((msg) => this.storeUpdater?.(msg))
  }

  // ============================================================
  // ENVÍO DE MENSAJES
  // ============================================================

  send(message: WSMessage): boolean {
    const now = Date.now()

    // rate limit -> encola
    if (now - this.lastMessageTime < this.config.rateLimitMs) {
      this._queueMessage(message)
      return false
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      // ✅ Protocolo: ts (no timestamp)
      const enrichedMessage = {
        ...message,
        ts: Date.now()
      }

      try {
        this.ws.send(JSON.stringify(enrichedMessage))
        this.lastMessageTime = now
        return true
      } catch (error) {
        console.error('❌ Error enviando mensaje:', error)
        this._queueMessage(message)
        return false
      }
    } else {
      console.warn('⚠️ WebSocket no conectado, encolando mensaje')
      this._queueMessage(message)
      return false
    }
  }

  sendThrottled(message: WSMessage, throttleMs: number = 100): boolean {
    const now = Date.now()
    if (now - this.lastMessageTime < throttleMs) {
      return false
    }
    return this.send(message)
  }

  private _queueMessage(message: WSMessage): void {
    if (this.messageQueue.length < this.config.messageQueueSize) {
      this.messageQueue.push(message)
    } else {
      console.warn('⚠️ Cola de mensajes llena, descartando mensaje más antiguo')
      this.messageQueue.shift()
      this.messageQueue.push(message)
    }
  }

  private _flushMessageQueue(): void {
    const queue = [...this.messageQueue]
    this.messageQueue = []

    queue.forEach((message, index) => {
      setTimeout(() => {
        this.send(message)
      }, index * this.config.rateLimitMs)
    })
  }

  // ============================================================
  // ACCIONES DE ALTO NIVEL (action + snake_case)
  // ============================================================

  initialize(elements: any[], dimensions?: { length: number; width: number }): void {
    this.send({
      action: 'init',
      elements,
      dimensions
    })
  }

  moveElement(elementId: string, x: number, y: number): void {
    this.send({
      action: 'move',
      element_id: elementId,
      position: { x, y }
    })
  }

  resizeElement(elementId: string, width: number, height: number, anchor: string = 'center'): void {
    this.send({
      action: 'resize',
      element_id: elementId,
      dimensions: { width, height },
      anchor
    })
  }

  rotateElement(elementId: string, rotation: number): void {
    this.send({
      action: 'rotate',
      element_id: elementId,
      rotation
    })
  }

  addElement(element: any): void {
    this.send({
      action: 'add',
      element
    })
  }

  deleteElement(elementId: string): void {
    this.send({
      action: 'delete',
      element_id: elementId
    })
  }

  undo(): void {
    this.send({ action: 'undo' })
  }

  redo(): void {
    this.send({ action: 'redo' })
  }

  updateCursor(x: number, y: number): void {
    // ✅ Mantengo tu throttling, pero mando position (más estándar)
    this.sendThrottled(
      {
        action: 'cursor',
        position: { x, y }
      },
      100
    )
  }

  selectElement(elementId: string | null): void {
    if (elementId === null) {
      this.send({ action: 'deselect' })
      return
    }
    this.send({
      action: 'select',
      element_id: elementId
    })
  }

  lockElement(elementId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const handler = (data: WSMessage) => {
        // En tu backend actualizado: lock_ack (ok) es lo normal
        if (
          (data.type === 'lock_ack' || data.type === 'lock_result') &&
          data.element_id === elementId
        ) {
          this.off(data.type, handler)
          resolve(Boolean(data.ok ?? data.success))
        }
      }

      this.on('lock_ack', handler)
      this.on('lock_result', handler)

      this.send({
        action: 'lock',
        element_id: elementId
      })

      setTimeout(() => {
        this.off('lock_ack', handler)
        this.off('lock_result', handler)
        resolve(false)
      }, 5000)
    })
  }

  unlockElement(elementId: string): void {
    this.send({
      action: 'unlock',
      element_id: elementId
    })
  }

  sendChatMessage(message: string): void {
    this.send({
      action: 'chat',
      message
    })
  }

  requestState(): void {
    this.send({ action: 'get_state' })
  }

  resetLayout(): void {
    this.send({ action: 'reset' })
  }

  // ============================================================
  // EVENT EMITTER
  // ============================================================

  on(event: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, new Set())
    }
    this.messageHandlers.get(event)!.add(handler)
  }

  off(event: string, handler: MessageHandler): void {
    this.messageHandlers.get(event)?.delete(handler)
  }

  onAny(handler: MessageHandler): void {
    this.globalHandlers.add(handler)
  }

  offAny(handler: MessageHandler): void {
    this.globalHandlers.delete(handler)
  }

  private _emit(event: string, data: any): void {
    this.messageHandlers.get(event)?.forEach((handler) => {
      try {
        handler(data)
      } catch (error) {
        console.error(`Error en handler de ${event}:`, error)
      }
    })
  }

  waitFor(event: string, timeout: number = 5000): Promise<WSMessage> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(event, handler)
        reject(new Error(`Timeout esperando ${event}`))
      }, timeout)

      const handler = (data: WSMessage) => {
        clearTimeout(timer)
        this.off(event, handler)
        resolve(data)
      }

      this.on(event, handler)
    })
  }

  // ============================================================
  // RECONEXIÓN
  // ============================================================

  private _scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('❌ Máximo de intentos de reconexión alcanzado')
      this._emit('reconnect_failed', { attempts: this.reconnectAttempts, ts: Date.now() })
      return
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }

    console.log(
      `🔄 Reconectando en ${this.currentReconnectDelay}ms... (intento ${this.reconnectAttempts + 1})`
    )

    this.onReconnectingCallback?.(this.reconnectAttempts + 1)

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++
      this._createConnection()

      this.currentReconnectDelay = Math.min(
        this.currentReconnectDelay * this.config.reconnectMultiplier,
        this.config.maxReconnectDelay
      )
    }, this.currentReconnectDelay)
  }

  reconnect(): void {
    this.disconnect()
    this.reconnectAttempts = 0
    this.currentReconnectDelay = this.config.reconnectDelay

    if (this.sessionId) {
      this._createConnection()
    }
  }

  // ============================================================
  // HEARTBEAT
  // ============================================================

  private _startHeartbeat(): void {
    this._stopHeartbeat()

    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // enviamos ping (backend responde pong)
        this.send({ action: 'ping' })

        // timeout local: si no hay pong, forzamos close para reconectar
        this.heartbeatTimeout = setTimeout(() => {
          const timeSinceLastPong = Date.now() - this.lastPongTime
          if (timeSinceLastPong > this.config.heartbeatInterval + this.config.heartbeatTimeout) {
            console.warn('⚠️ Heartbeat timeout, reconectando...')
            try {
              this.ws?.close()
            } catch {}
          }
        }, this.config.heartbeatTimeout)
      }
    }, this.config.heartbeatInterval)
  }

  private _stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    this._clearHeartbeatTimeout()
  }

  private _clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout)
      this.heartbeatTimeout = null
    }
  }

  // ============================================================
  // DESCONEXIÓN
  // ============================================================

  disconnect(): void {
    console.log('🔌 Desconectando WebSocket manualmente')

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    this._stopHeartbeat()

    if (this.ws) {
      try {
        this.ws.close(1000, 'Desconexión manual')
      } catch {}
      this.ws = null
    }

    this.clientId = null
    this.messageQueue = []
    this.inbox = []
    this.onDisconnectedCallback?.()
  }

  // ============================================================
  // UTILIDADES
  // ============================================================

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  isConnecting(): boolean {
    return this.ws?.readyState === WebSocket.CONNECTING
  }

  getSessionId(): string | null {
    return this.sessionId
  }

  getUserName(): string {
    return this.userName
  }

  getBaseUrl(): string {
    return this.baseUrl
  }

  getQueueSize(): number {
    return this.messageQueue.length
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts
  }

  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED
  }

  getReadyStateString(): string {
    switch (this.ws?.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING'
      case WebSocket.OPEN:
        return 'OPEN'
      case WebSocket.CLOSING:
        return 'CLOSING'
      case WebSocket.CLOSED:
        return 'CLOSED'
      default:
        return 'UNKNOWN'
    }
  }

  configure(options: Partial<typeof DEFAULT_CONFIG>): void {
    this.config = { ...this.config, ...options }
  }

  getStats(): object {
    return {
      sessionId: this.sessionId,
      userName: this.userName,
      baseUrl: this.baseUrl,
      clientId: this.clientId,
      connected: this.isConnected(),
      readyState: this.getReadyStateString(),
      queueSize: this.messageQueue.length,
      inboxSize: this.inbox.length,
      reconnectAttempts: this.reconnectAttempts,
      lastPongTime: this.lastPongTime,
      handlerCount: this.messageHandlers.size,
      globalHandlerCount: this.globalHandlers.size
    }
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

const wsManager = new WebSocketManager()

export default wsManager
export { WebSocketManager }
