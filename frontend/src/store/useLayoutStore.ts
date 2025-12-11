/**
 * UNITNAVE Designer - Layout Store (V1.1)
 * State management con Zustand para edición interactiva
 */

import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'

// ============================================================
// TYPES
// ============================================================

export interface Position {
  x: number
  y: number
  z?: number
}

export interface Dimensions {
  length?: number
  width?: number
  height?: number
  depth?: number
}

export interface WarehouseElement {
  id: string
  type: 'shelf' | 'dock' | 'office' | 'zone' | 'service_room' | 'technical_room' | 'unknown'
  position: Position
  dimensions: Dimensions
  rotation?: number
  properties?: Record<string, any>
  label?: string
  layer?: string
}

export interface Zone {
  id: string
  type: string
  label: string
  x: number
  y: number
  width: number
  height: number
  area: number
  centroid_x: number
  centroid_y: number
  polygon_points?: [number, number][]
  is_auto_generated: boolean
}

export interface Metrics {
  total_area: number
  occupied_area: number
  free_area: number
  aisle_area: number
  circulation_area: number
  storage_area: number
  efficiency: number
  aisle_percentage: number
  storage_percentage: number
  element_count: number
  zone_count: number
}

export interface OnlineUser {
  client_id: string
  session_id: string
  user_name: string
  cursor_position?: { x: number; y: number } | null
  selected_element?: string | null
  connected_at: string
}

export interface Warning {
  type: string
  severity: 'warning' | 'error' | 'info'
  message: string
  element_id?: string
  zone_id?: string
  value?: number
  min_value?: number
}

interface LayoutState {
  sessionId: string | null
  clientId: string | null
  dimensions: { length: number; width: number; height: number }
  elements: WarehouseElement[]
  zones: Zone[]
  metrics: Metrics | null
  warnings: Warning[]
  selectedElementId: string | null
  hoveredElementId: string | null
  isDragging: boolean
  isResizing: boolean
  isRotating: boolean
  isProcessing: boolean
  isInitializing: boolean
  isConnected: boolean
  reconnectAttempts: number
  lastSyncTimestamp: number | null
  lastError: string | null
  onlineUsers: OnlineUser[]
  lockedElements: Record<string, string>
  canUndo: boolean
  canRedo: boolean
}

interface LayoutActions {
  setSession: (sessionId: string, clientId: string) => void
  setDimensions: (dims: { length: number; width: number; height?: number }) => void
  setElements: (elements: WarehouseElement[]) => void
  addElement: (element: WarehouseElement) => void
  updateElement: (id: string, updates: Partial<WarehouseElement>) => void
  deleteElement: (id: string) => void
  moveElementOptimistic: (id: string, x: number, y: number) => void
  setZones: (zones: Zone[]) => void
  updateZones: (zones: Zone[], metrics?: Metrics | null) => void
  setMetrics: (metrics: Metrics | null) => void
  setWarnings: (warnings: Warning[]) => void
  setSelectedElement: (id: string | null) => void
  setHoveredElement: (id: string | null) => void
  setDragging: (isDragging: boolean) => void
  setResizing: (isResizing: boolean) => void
  setRotating: (isRotating: boolean) => void
  setProcessing: (isProcessing: boolean) => void
  setInitializing: (isInitializing: boolean) => void
  setConnected: (isConnected: boolean) => void
  incrementReconnectAttempts: () => void
  resetReconnectAttempts: () => void
  setLastSync: (timestamp: number) => void
  setError: (error: string | null) => void
  setOnlineUsers: (users: OnlineUser[]) => void
  addOnlineUser: (user: OnlineUser) => void
  removeOnlineUser: (clientId: string) => void
  updateUserCursor: (clientId: string, position: { x: number; y: number }) => void
  updateUserSelection: (clientId: string, elementId: string | null) => void
  setLockedElements: (locked: Record<string, string>) => void
  lockElement: (elementId: string, clientId: string) => void
  unlockElement: (elementId: string) => void
  isElementLockedByOther: (elementId: string) => boolean
  setCanUndo: (canUndo: boolean) => void
  setCanRedo: (canRedo: boolean) => void
  reset: () => void
}

// ============================================================
// INITIAL STATE
// ============================================================

const initialState: LayoutState = {
  sessionId: null,
  clientId: null,
  dimensions: { length: 80, width: 40, height: 10 },
  elements: [],
  zones: [],
  metrics: null,
  warnings: [],
  selectedElementId: null,
  hoveredElementId: null,
  isDragging: false,
  isResizing: false,
  isRotating: false,
  isProcessing: false,
  isInitializing: false,
  isConnected: false,
  reconnectAttempts: 0,
  lastSyncTimestamp: null,
  lastError: null,
  onlineUsers: [],
  lockedElements: {},
  canUndo: false,
  canRedo: false
}

// ============================================================
// STORE
// ============================================================

export const useLayoutStore = create<LayoutState & LayoutActions>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,
      
      setSession: (sessionId, clientId) => set({ sessionId, clientId }, false, 'setSession'),
      
      setDimensions: (dims) => set({ 
        dimensions: { 
          length: dims.length, 
          width: dims.width, 
          height: dims.height || 10 
        } 
      }, false, 'setDimensions'),
      
      setElements: (elements) => set({ elements }, false, 'setElements'),
      
      addElement: (element) => set((state) => ({
        elements: [...state.elements, element]
      }), false, 'addElement'),
      
      updateElement: (id, updates) => set((state) => ({
        elements: state.elements.map(el => 
          el.id === id ? { ...el, ...updates } : el
        )
      }), false, 'updateElement'),
      
      deleteElement: (id) => set((state) => ({
        elements: state.elements.filter(el => el.id !== id),
        selectedElementId: state.selectedElementId === id ? null : state.selectedElementId
      }), false, 'deleteElement'),
      
      moveElementOptimistic: (id, x, y) => set((state) => ({
        elements: state.elements.map(el => 
          el.id === id ? { ...el, position: { ...el.position, x, y } } : el
        )
      }), false, 'moveElementOptimistic'),
      
      setZones: (zones) => set({ zones }, false, 'setZones'),
      
      updateZones: (zones, metrics) => set((state) => ({
        zones,
        metrics: metrics ?? state.metrics
      }), false, 'updateZones'),
      
      setMetrics: (metrics) => set({ metrics }, false, 'setMetrics'),
      
      setWarnings: (warnings) => set({ warnings }, false, 'setWarnings'),
      
      setSelectedElement: (id) => set({ selectedElementId: id }, false, 'setSelectedElement'),
      
      setHoveredElement: (id) => set({ hoveredElementId: id }, false, 'setHoveredElement'),
      
      setDragging: (isDragging) => set({ isDragging }, false, 'setDragging'),
      
      setResizing: (isResizing) => set({ isResizing }, false, 'setResizing'),
      
      setRotating: (isRotating) => set({ isRotating }, false, 'setRotating'),
      
      setProcessing: (isProcessing) => set({ isProcessing }, false, 'setProcessing'),
      
      setInitializing: (isInitializing) => set({ isInitializing }, false, 'setInitializing'),
      
      setConnected: (isConnected) => set({ isConnected }, false, 'setConnected'),
      
      incrementReconnectAttempts: () => set((state) => ({ 
        reconnectAttempts: state.reconnectAttempts + 1 
      }), false, 'incrementReconnectAttempts'),
      
      resetReconnectAttempts: () => set({ reconnectAttempts: 0 }, false, 'resetReconnectAttempts'),
      
      setLastSync: (timestamp) => set({ lastSyncTimestamp: timestamp }, false, 'setLastSync'),
      
      setError: (error) => {
        set({ lastError: error }, false, 'setError')
        if (error) {
          setTimeout(() => set({ lastError: null }, false, 'clearError'), 5000)
        }
      },
      
      setOnlineUsers: (users) => set({ 
        onlineUsers: users || [],
        lockedElements: (users || []).reduce((acc: Record<string, string>, u: any) => {
          if (u.selected_element) {
            acc[u.selected_element] = u.client_id
          }
          return acc
        }, {})
      }, false, 'setOnlineUsers'),
      
      addOnlineUser: (user) => set((state) => ({
        onlineUsers: state.onlineUsers.some(u => u.client_id === user.client_id)
          ? state.onlineUsers
          : [...state.onlineUsers, user]
      }), false, 'addOnlineUser'),
      
      removeOnlineUser: (clientId) => set((state) => {
        const updatedUsers = state.onlineUsers.filter(u => u.client_id !== clientId)
        const updatedLocked = { ...state.lockedElements }
        Object.keys(updatedLocked).forEach(elId => {
          if (updatedLocked[elId] === clientId) {
            delete updatedLocked[elId]
          }
        })
        return {
          onlineUsers: updatedUsers,
          lockedElements: updatedLocked
        }
      }, false, 'removeOnlineUser'),
      
      updateUserCursor: (clientId, position) => set((state) => ({
        onlineUsers: state.onlineUsers.map(u =>
          u.client_id === clientId ? { ...u, cursor_position: position } : u
        )
      }), false, 'updateUserCursor'),
      
      updateUserSelection: (clientId, elementId) => set((state) => ({
        onlineUsers: state.onlineUsers.map(u =>
          u.client_id === clientId ? { ...u, selected_element: elementId } : u
        ),
        lockedElements: elementId ? 
          { ...state.lockedElements, [elementId]: clientId } : 
          Object.fromEntries(Object.entries(state.lockedElements).filter(([_, cid]) => cid !== clientId))
      }), false, 'updateUserSelection'),
      
      setLockedElements: (locked) => set({ lockedElements: locked }, false, 'setLockedElements'),
      
      lockElement: (elementId, clientId) => set((state) => ({
        lockedElements: { ...state.lockedElements, [elementId]: clientId }
      }), false, 'lockElement'),
      
      unlockElement: (elementId) => set((state) => {
        const { [elementId]: _, ...rest } = state.lockedElements
        return { lockedElements: rest }
      }, false, 'unlockElement'),
      
      isElementLockedByOther: (elementId) => {
        const state = get()
        const lockedBy = state.lockedElements[elementId]
        return lockedBy !== undefined && lockedBy !== state.clientId
      },
      
      setCanUndo: (canUndo) => set({ canUndo }, false, 'setCanUndo'),
      
      setCanRedo: (canRedo) => set({ canRedo }, false, 'setCanRedo'),
      
      reset: () => set(initialState, false, 'reset')
    })),
    {
      name: 'unitnave-layout-store',
      enabled: true
    }
  )
)

// ============================================================
// SELECTORS
// ============================================================

export const selectElements = (state: LayoutState) => state.elements
export const selectZones = (state: LayoutState) => state.zones
export const selectMetrics = (state: LayoutState) => state.metrics
export const selectSelectedElement = (state: LayoutState) => 
  state.elements.find(el => el.id === state.selectedElementId) || null
export const selectIsConnected = (state: LayoutState) => state.isConnected
export const selectOnlineUsers = (state: LayoutState) => state.onlineUsers

// ============================================================
// HOOKS
// ============================================================

export const useSelectedElement = () => 
  useLayoutStore((state) => state.elements.find(el => el.id === state.selectedElementId))

export const useIsElementLocked = (elementId: string) =>
  useLayoutStore((state) => {
    const lockedBy = state.lockedElements[elementId]
    return lockedBy !== undefined && lockedBy !== state.clientId
  })

export const useOtherUsersCursors = () =>
  useLayoutStore((state) => 
    state.onlineUsers.filter(u => 
      u.client_id !== state.clientId && u.cursor_position
    )
  )

export default useLayoutStore