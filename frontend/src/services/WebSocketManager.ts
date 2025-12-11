/**
 * UNITNAVE Designer - WebSocket Manager (V1.0)
 * Cliente WebSocket con reconexión automática
 * 
 * Características:
 * - Reconexión automática con backoff exponencial
 * - Heartbeat para mantener conexión
 * - Cola de mensajes cuando está desconectado
 * - Event emitter para handlers personalizados
 * - Rate limiting de mensajes salientes
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
  messageQueueSize: 100,
  rateLimitMs: 33 // ~30 mensajes por segundo
}

// ============================================================
// WEBSOCKET MANAGER CLASS
// ============================================================

class WebSocketManager {
  private ws: WebSocket | null = null
  private sessionId: string | null = null
  private userName: string = 'Anónimo'
  private config = { ...DEFAULT_CONFIG }
  
  // Reconexión
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts: number = 0
  private currentReconnectDelay: number = DEFAULT_CONFIG.reconnectDelay
  
  // Heartbeat
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null
  private lastPongTime: number = Date.now()
  
  // Cola de mensajes
  private messageQueue: WSMessage[] = []
  
  // Rate limiting
  private lastMessageTime: number = 0
  
  // Event handlers
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map()
  private globalHandlers: Set<MessageHandler> = new Set()
  
  // Store updater callback - REEMPLAZA el import directo
  private storeUpdater: StoreUpdater | null = null
  private onConnectedCallback: (() => void) | null = null
  private onDisconnectedCallback: (() => void) | null = null
  private onReconnectingCallback: ((attempt: number) => void) | null = null
  
  // ============================================================
  // STORE CALLBACK REGISTRATION
  // ============================================================
  
  /**
   * Registra el callback que actualiza el store
   * Llamar desde el componente principal
   */
  setStoreUpdater(updater: StoreUpdater): void {
    this.storeUpdater = updater
  }
  
  /**
   * Callback cuando se conecta
   */
  setOnConnected(callback: () => void): void {
    this.onConnectedCallback = callback
  }
  
  /**
   * Callback cuando se desconecta
   */
  setOnDisconnected(callback: () => void): void {
    this.onDisconnectedCallback = callback
  }
  
  /**
   * Callback durante reconexión
   */
  setOnReconnecting(callback: (attempt: number) => void): void {
    this.onReconnectingCallback = callback
  }
  
  // ============================================================
  // CONEXIÓN
  // ============================================================
  
  connect(sessionId: string, userName: string = 'Anónimo'): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.warn('⚠️ WebSocket ya está conectado')
      return
    }
    
    this.sessionId = sessionId
    this.userName = userName
    this.reconnectAttempts = 0
    this.currentReconnectDelay = this.config.reconnectDelay
    
    this._createConnection()
  }
  
  private _createConnection(): void {
    if (!this.sessionId) {
      console.error('❌ No hay sessionId para conectar')
      return
    }
    
    // URL del WebSocket - usa window.location directamente
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const baseUrl = `${protocol}//${host}`
    const wsUrl = `${baseUrl}/ws/layout/${this.sessionId}?user=${encodeURIComponent(this.userName)}`
    
    console.log(`🔌 Conectando WebSocket: ${wsUrl}`)
    
    try {
      this.ws = new WebSocket(wsUrl)
      this._setupEventListeners()
    } catch (error) {
      console.error('❌ Error creando WebSocket:', error)
      this._scheduleReconnect()
    }
  }
  
  private _setupEventListeners(): void {
    if (!this.ws) return
    
    this.ws.onopen = this._handleOpen.bind(this)
    this.ws.onmessage = this._handleMessage.bind(this)
    this.ws.onclose = this._handleClose.bind(this)
    this.ws.onerror = this._handleError.bind(this)
  }
  
  // ============================================================
  // EVENT HANDLERS
  // ============================================================
  
  private _handleOpen(): void {
    console.log('✅ WebSocket conectado')
    
    // Notificar via callback
    this.onConnectedCallback?.()
    
    // Resetear reconexión
    this.reconnectAttempts = 0
    this.currentReconnectDelay = this.config.reconnectDelay
    
    // Iniciar heartbeat
    this._startHeartbeat()
    
    // Enviar mensajes pendientes
    this._flushMessageQueue()
    
    // Notificar handlers
    this._emit('connected', { sessionId: this.sessionId })
  }
  
  private _handleMessage(event: MessageEvent): void {
    try {
      const data: WSMessage = JSON.parse(event.data)
      
      // Manejar pong
      if (data.type === 'pong' || data.type === 'ping') {
        this.lastPongTime = Date.now()
        this._clearHeartbeatTimeout()
        // Responder ping con pong
        if (data.type === 'ping') {
          this.send({ action: 'pong' })
        }
        return
      }
      
      // Actualizar store via callback
      if (this.storeUpdater) {
        this.storeUpdater(data)
      }
      
      // Notificar handlers específicos
      if (data.type) {
        this._emit(data.type, data)
      }
      
      // Notificar handlers globales
      this.globalHandlers.forEach(handler => handler(data))
      
    } catch (error) {
      console.error('❌ Error procesando mensaje WS:', error)
    }
  }
  
  private _handleClose(event: CloseEvent): void {
    console.log(`🔌 WebSocket cerrado: ${event.code} - ${event.reason}`)
    
    // Notificar via callback
    this.onDisconnectedCallback?.()
    
    // Parar heartbeat
    this._stopHeartbeat()
    
    // Notificar handlers
    this._emit('disconnected', { code: event.code, reason: event.reason })
    
    // Programar reconexión si no fue cierre intencional
    if (event.code !== 1000) {
      this._scheduleReconnect()
    }
  }
  
  private _handleError(event: Event): void {
    console.error('❌ WebSocket error:', event)
    this._emit('error', { error: event })
  }
  
  // ============================================================
  // ENVÍO DE MENSAJES
  // ============================================================
  
  send(message: WSMessage): boolean {
    // Rate limiting
    const now = Date.now()
    if (now - this.lastMessageTime < this.config.rateLimitMs) {
      // Encolar si estamos enviando muy rápido
      this._queueMessage(message)
      return false
    }
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      const enrichedMessage = {
        ...message,
        timestamp: Date.now()
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
  
  /**
   * Envío con rate limiting específico para cursores
   */
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
      // Espaciar mensajes para no saturar
      setTimeout(() => {
        this.send(message)
      }, index * this.config.rateLimitMs)
    })
  }
  
  // ============================================================
  // ACCIONES DE ALTO NIVEL
  // ============================================================
  
  /**
   * Inicializar sesión con elementos y dimensiones
   */
  initialize(elements: any[], dimensions?: { length: number; width: number }): void {
    this.send({
      action: 'init',
      elements,
      dimensions
    })
  }
  
  /**
   * Mover elemento
   */
  moveElement(elementId: string, x: number, y: number): void {
    this.send({
      action: 'move',
      element_id: elementId,
      position: { x, y }
    })
  }
  
  /**
   * Redimensionar elemento
   */
  resizeElement(elementId: string, width: number, height: number, anchor: string = 'center'): void {
    this.send({
      action: 'resize',
      element_id: elementId,
      dimensions: { width, height },
      anchor
    })
  }
  
  /**
   * Rotar elemento
   */
  rotateElement(elementId: string, rotation: number): void {
    this.send({
      action: 'rotate',
      element_id: elementId,
      rotation
    })
  }
  
  /**
   * Añadir elemento
   */
  addElement(element: any): void {
    this.send({
      action: 'add',
      element
    })
  }
  
  /**
   * Eliminar elemento
   */
  deleteElement(elementId: string): void {
    this.send({
      action: 'delete',
      element_id: elementId
    })
  }
  
  /**
   * Deshacer
   */
  undo(): void {
    this.send({ action: 'undo' })
  }
  
  /**
   * Rehacer
   */
  redo(): void {
    this.send({ action: 'redo' })
  }
  
  /**
   * Actualizar posición del cursor (throttled)
   */
  updateCursor(x: number, y: number): void {
    this.sendThrottled({
      action: 'cursor',
      x,
      y
    }, 100)
  }
  
  /**
   * Seleccionar elemento
   */
  selectElement(elementId: string | null): void {
    this.send({
      action: 'select',
      element_id: elementId
    })
  }
  
  /**
   * Bloquear elemento para edición exclusiva
   */
  lockElement(elementId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const handler = (data: WSMessage) => {
        if (data.type === 'lock_result' && data.element_id === elementId) {
          this.off('lock_result', handler)
          resolve(data.success)
        }
      }
      
      this.on('lock_result', handler)
      
      this.send({
        action: 'lock',
        element_id: elementId
      })
      
      // Timeout
      setTimeout(() => {
        this.off('lock_result', handler)
        resolve(false)
      }, 5000)
    })
  }
  
  /**
   * Desbloquear elemento
   */
  unlockElement(elementId: string): void {
    this.send({
      action: 'unlock',
      element_id: elementId
    })
  }
  
  /**
   * Enviar mensaje de chat
   */
  sendChatMessage(message: string): void {
    this.send({
      action: 'chat',
      message
    })
  }
  
  /**
   * Solicitar estado actual
   */
  requestState(): void {
    this.send({ action: 'get_state' })
  }
  
  /**
   * Resetear layout
   */
  resetLayout(): void {
    this.send({ action: 'reset' })
  }
  
  // ============================================================
  // EVENT EMITTER
  // ============================================================
  
  /**
   * Suscribirse a un tipo de mensaje específico
   */
  on(event: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, new Set())
    }
    this.messageHandlers.get(event)!.add(handler)
  }
  
  /**
   * Desuscribirse de un tipo de mensaje
   */
  off(event: string, handler: MessageHandler): void {
    this.messageHandlers.get(event)?.delete(handler)
  }
  
  /**
   * Suscribirse a todos los mensajes
   */
  onAny(handler: MessageHandler): void {
    this.globalHandlers.add(handler)
  }
  
  /**
   * Desuscribirse de todos los mensajes
   */
  offAny(handler: MessageHandler): void {
    this.globalHandlers.delete(handler)
  }
  
  /**
   * Emitir evento a handlers
   */
  private _emit(event: string, data: any): void {
    this.messageHandlers.get(event)?.forEach(handler => {
      try {
        handler(data)
      } catch (error) {
        console.error(`Error en handler de ${event}:`, error)
      }
    })
  }
  
  /**
   * Esperar a un tipo de mensaje específico (Promise)
   */
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
      this._emit('reconnect_failed', { attempts: this.reconnectAttempts })
      return
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }
    
    console.log(`🔄 Reconectando en ${this.currentReconnectDelay}ms... (intento ${this.reconnectAttempts + 1})`)
    
    // Notificar via callback
    this.onReconnectingCallback?.(this.reconnectAttempts + 1)
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++
      
      this._createConnection()
      
      // Aumentar delay para siguiente intento
      this.currentReconnectDelay = Math.min(
        this.currentReconnectDelay * this.config.reconnectMultiplier,
        this.config.maxReconnectDelay
      )
    }, this.currentReconnectDelay)
  }
  
  /**
   * Forzar reconexión manual
   */
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
        this.send({ action: 'ping' })
        
        // Timeout para esperar pong
        this.heartbeatTimeout = setTimeout(() => {
          const timeSinceLastPong = Date.now() - this.lastPongTime
          if (timeSinceLastPong > this.config.heartbeatInterval + this.config.heartbeatTimeout) {
            console.warn('⚠️ Heartbeat timeout, reconectando...')
            this.ws?.close()
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
    
    // Cancelar reconexión pendiente
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    
    // Parar heartbeat
    this._stopHeartbeat()
    
    // Cerrar conexión
    if (this.ws) {
      this.ws.close(1000, 'Desconexión manual')
      this.ws = null
    }
    
    // Limpiar cola
    this.messageQueue = []
    
    // Notificar
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
      case WebSocket.CONNECTING: return 'CONNECTING'
      case WebSocket.OPEN: return 'OPEN'
      case WebSocket.CLOSING: return 'CLOSING'
      case WebSocket.CLOSED: return 'CLOSED'
      default: return 'UNKNOWN'
    }
  }
  
  /**
   * Configurar opciones
   */
  configure(options: Partial<typeof DEFAULT_CONFIG>): void {
    this.config = { ...this.config, ...options }
  }
  
  /**
   * Obtener estadísticas
   */
  getStats(): object {
    return {
      sessionId: this.sessionId,
      userName: this.userName,
      connected: this.isConnected(),
      readyState: this.getReadyStateString(),
      queueSize: this.messageQueue.length,
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
