"""
UNITNAVE Designer - WebSocket Routes V2.1 PRODUCTION
Endpoints WebSocket para edición interactiva en tiempo real.
TODO INCLUIDO - Sin dependencias externas que puedan fallar.

ARCHIVO: backend/websocket_routes.py
"""

import os
import uuid
import asyncio
import logging
import json
from datetime import datetime
from typing import Dict, Any, Optional, List, Set
from dataclasses import dataclass, field

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from pydantic import BaseModel

# ============================================================
# LOGGING CONFIGURACIÓN ULTRA-DETALLADA
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)  # Cambia a DEBUG para más detalle

# ============================================================
# CONFIGURACIÓN DE PRODUCCIÓN
# ============================================================

DEFAULT_LENGTH = float(os.getenv("WAREHOUSE_LENGTH", "80"))
DEFAULT_WIDTH = float(os.getenv("WAREHOUSE_WIDTH", "40"))

# ============================================================
# WEBSOCKET MANAGER (INCLUIDO AQUÍ - NO IMPORT EXTERNO)
# ============================================================

@dataclass
class ClientInfo:
    """Información de un cliente conectado"""
    websocket: WebSocket
    session_id: str
    client_id: str
    user_name: str
    selected_element: Optional[str] = None
    connected_at: datetime = field(default_factory=datetime.now)
    cursor_x: float = 0
    cursor_y: float = 0
    locked_elements: Set[str] = field(default_factory=set)


class WebSocketManager:
    """Gestor de conexiones WebSocket - INCLUIDO INLINE"""
    
    def __init__(self):
        self.clients: Dict[str, ClientInfo] = {}
        self.sessions: Dict[str, Set[str]] = {}
        self.element_locks: Dict[str, Dict[str, str]] = {}
        logger.info("✅ WebSocketManager inicializado (inline)")
    
    async def connect(self, websocket: WebSocket, session_id: str, client_id: str, user_name: str) -> bool:
        """Registra una nueva conexión"""
        try:
            client_info = ClientInfo(
                websocket=websocket,
                session_id=session_id,
                client_id=client_id,
                user_name=user_name
            )
            
            self.clients[client_id] = client_info
            
            if session_id not in self.sessions:
                self.sessions[session_id] = set()
            self.sessions[session_id].add(client_id)
            
            if session_id not in self.element_locks:
                self.element_locks[session_id] = {}
            
            logger.info(f"✅ Cliente {client_id} ({user_name}) conectado a sesión {session_id}")
            logger.info(f"   Total clientes en sesión: {len(self.sessions[session_id])}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error conectando cliente: {e}")
            return False
    
    def disconnect(self, client_id: str):
        """Desconecta un cliente"""
        try:
            if client_id not in self.clients:
                return
            
            client_info = self.clients[client_id]
            session_id = client_info.session_id
            
            # Liberar locks
            if session_id in self.element_locks:
                elements_to_unlock = [
                    el_id for el_id, cid in self.element_locks[session_id].items()
                    if cid == client_id
                ]
                for el_id in elements_to_unlock:
                    del self.element_locks[session_id][el_id]
            
            # Remover de sesión
            if session_id in self.sessions:
                self.sessions[session_id].discard(client_id)
                if len(self.sessions[session_id]) == 0:
                    del self.sessions[session_id]
                    if session_id in self.element_locks:
                        del self.element_locks[session_id]
            
            del self.clients[client_id]
            logger.info(f"👋 Cliente {client_id} desconectado")
            
        except Exception as e:
            logger.error(f"⚠️ Error desconectando cliente: {e}")
    
    async def broadcast_to_session(self, session_id: str, message: dict, exclude: Optional[str] = None):
        """Envía mensaje a todos los clientes de una sesión"""
        if session_id not in self.sessions:
            return
        
        dead_clients = []
        
        for client_id in list(self.sessions[session_id]):
            if client_id == exclude:
                continue
            
            if client_id not in self.clients:
                dead_clients.append(client_id)
                continue
            
            try:
                await self.clients[client_id].websocket.send_json(message)
            except Exception as e:
                logger.warning(f"⚠️ Error enviando a {client_id}: {e}")
                dead_clients.append(client_id)
        
        for client_id in dead_clients:
            self.disconnect(client_id)
    
    async def try_lock_element(self, session_id: str, element_id: str, client_id: str) -> bool:
        """Intenta bloquear un elemento"""
        if session_id not in self.element_locks:
            self.element_locks[session_id] = {}
        
        locks = self.element_locks[session_id]
        
        if element_id in locks and locks[element_id] != client_id:
            return False
        
        locks[element_id] = client_id
        
        if client_id in self.clients:
            self.clients[client_id].locked_elements.add(element_id)
            self.clients[client_id].selected_element = element_id
        
        return True
    
    def unlock_element(self, client_id: str, element_id: str):
        """Desbloquea un elemento"""
        if client_id not in self.clients:
            return
        
        client_info = self.clients[client_id]
        session_id = client_info.session_id
        
        if session_id in self.element_locks:
            if element_id in self.element_locks[session_id]:
                if self.element_locks[session_id][element_id] == client_id:
                    del self.element_locks[session_id][element_id]
        
        client_info.locked_elements.discard(element_id)
        if client_info.selected_element == element_id:
            client_info.selected_element = None
    
    def update_cursor(self, client_id: str, x: float, y: float):
        """Actualiza posición del cursor"""
        if client_id in self.clients:
            self.clients[client_id].cursor_x = x
            self.clients[client_id].cursor_y = y
    
    def get_session_users(self, session_id: str) -> List[dict]:
        """Obtiene lista de usuarios en una sesión"""
        users: List[dict] = []
        if session_id in self.sessions:
            for client_id in self.sessions[session_id]:
                info = self.clients.get(client_id)
                if not info:
                    continue
                users.append({
                    'client_id': info.client_id,
                    'session_id': info.session_id,
                    'user_name': info.user_name,
                    'cursor_position': {'x': info.cursor_x, 'y': info.cursor_y},
                    'cursor': {'x': info.cursor_x, 'y': info.cursor_y},  # legacy
                    'selected_element': info.selected_element,
                    'connected_at': info.connected_at.isoformat() if hasattr(info.connected_at, 'isoformat') else str(info.connected_at),
                    'locked_elements': list(info.locked_elements)
                })
        return users


# Instancia global del manager
manager = WebSocketManager()


# ============================================================
# INTERACTIVE LAYOUT ENGINE (INCLUIDO AQUÍ - NO IMPORT EXTERNO)
# ============================================================

class InteractiveLayoutEngine:
    """Engine para layout interactivo con recálculo de zonas"""
    
    def __init__(self, length: float = 80, width: float = 40):
        self.length = length
        self.width = width
        self.elements: Dict[str, dict] = {}
        self.zones: List[dict] = []
        self.metrics: dict = {}
        self.geometry_service = None
        self._try_load_geometry_service()
        logger.info(f"✅ InteractiveLayoutEngine creado: {length}x{width}")
    
    def _try_load_geometry_service(self):
        """Intenta cargar el servicio de geometría exacta"""
        try:
            from geometry_service import analyze_layout
            self.geometry_service = analyze_layout
            logger.info("✅ Servicio de geometría cargado en Engine")
        except ImportError:
            logger.warning("⚠️ geometry_service no disponible, usando cálculo simplificado")
            self.geometry_service = None
    
    def initialize_from_elements(self, elements: List[dict]) -> dict:
        """Inicializa desde lista de elementos"""
        self.elements = {}
        for el in elements:
            el_id = el.get('id', str(uuid.uuid4()))
            self.elements[el_id] = {
                'id': el_id,
                'type': el.get('type', 'unknown'),
                'position': el.get('position', {'x': 0, 'y': 0}),
                'dimensions': el.get('dimensions', {'width': 1, 'length': 1}),
                'rotation': el.get('rotation', 0),
                'properties': el.get('properties', {}),
                'layer': el.get('layer', 'default')
            }
        
        self._recalculate_all()
        
        return {
            'elements': list(self.elements.values()),
            'zones': self.zones,
            'metrics': self.metrics
        }
    
    async def move_element(self, element_id: str, x: float, y: float) -> dict:
        """Mueve un elemento a nueva posición - CORREGIDO CON LOGGING"""
        logger.info(f"🏗️ Engine.move_element llamado: {element_id} → ({x}, {y})")
        
        if element_id not in self.elements:
            logger.error(f"❌ Elemento {element_id} no existe")
            return {'error': f'Elemento {element_id} no encontrado'}
        
        # Obtener dimensiones reales (para clamp correcto sin salirte por el ancho/alto)
        el = self.elements[element_id]
        dims = (el.get('dimensions') or {})
        el_type = el.get('type', 'unknown')

        # Defaults por tipo (m)
        if el_type in ('shelf', 'rack'):
            w = float(dims.get('length') or dims.get('width') or 2.7)
            h = float(dims.get('depth') or dims.get('height') or 1.1)
        elif el_type == 'dock':
            w = float(dims.get('width') or dims.get('length') or 3.5)
            h = float(dims.get('depth') or dims.get('height') or 0.5)
        else:
            w = float(dims.get('length') or dims.get('width') or 2.0)
            h = float(dims.get('depth') or dims.get('height') or 2.0)

        # Snap to grid (0.5m) - CORRECCIÓN CRÍTICA
        x = round(float(x) / 0.5) * 0.5
        y = round(float(y) / 0.5) * 0.5

        # Validar límites (clamp CON tamaño)
        x = max(0, min(x, self.length - w))
        y = max(0, min(y, self.width - h))
        
        logger.info(f"📐 Snap aplicado: ({x}, {y})")
        
        # Actualizar posición
        self.elements[element_id]['position'] = {'x': x, 'y': y}
        
        # Recalcular todo
        self._recalculate_all()
        
        logger.info(f"✅ Recálculo completado: {len(self.zones)} zonas, {len(self.elements)} elementos")
        
        return {
            'success': True,
            'element': self.elements[element_id],
            'elements': list(self.elements.values()),
            'zones': self.zones,
            'metrics': self.metrics,
            'warnings': []
        }
    
    def get_state(self) -> dict:
        """Retorna estado actual"""
        return {
            'elements': list(self.elements.values()),
            'zones': self.zones,
            'metrics': self.metrics,
            'dimensions': {'length': self.length, 'width': self.width}
        }
    
    def _recalculate_all(self):
        """Recalcula zonas y métricas usando geometry_service si disponible"""
        logger.info("🔄 Iniciando recálculo completo de zonas...")
        
        if self.geometry_service and len(self.elements) > 0:
            try:
                result = self.geometry_service(
                    {'length': self.length, 'width': self.width},
                    list(self.elements.values())
                )
                self.zones = result.get('zones', [])
                self.metrics = result.get('metrics', {})
                logger.info(f"✅ Geometría recalculada: {len(self.zones)} zonas")
                return
            except Exception as e:
                logger.warning(f"⚠️ Error en geometry_service: {e}, usando fallback")
        
        # Fallback: cálculo simplificado
        self._recalculate_zones_simple()
        self._recalculate_metrics()
        logger.info("✅ Recálculo simplificado completado")
    
    def _recalculate_zones_simple(self):
        """Recalcula zonas (versión simplificada sin Shapely)"""
        self.zones = []
        zone_index = 0
        
        for el_id, el in self.elements.items():
            pos = el.get('position', {})
            dims = el.get('dimensions', {})
            
            x = pos.get('x', 0)
            y = pos.get('y', 0)
            
            el_type = el.get('type', 'unknown')
            if el_type == 'shelf':
                w = dims.get('length', 2.7)
                h = dims.get('depth', 1.1)
            elif el_type == 'dock':
                w = dims.get('width', 3.5)
                h = dims.get('depth', 0.5)
            elif el_type == 'office':
                w = dims.get('length', 12)
                h = dims.get('width', 8)
            else:
                w = dims.get('length', 3)
                h = dims.get('depth', 3)
            
            self.zones.append({
                'id': f'zone_{el_id}',
                'type': el_type,
                'x': x,
                'y': y,
                'width': w,
                'height': h,
                'area': w * h,
                'element_id': el_id,
                'is_auto_generated': False
            })
            
            if el_type == 'dock':
                maneuver_depth = 4
                self.zones.append({
                    'id': f'maneuver_{el_id}',
                    'type': 'dock_maneuver',
                    'x': x,
                    'y': y + h,
                    'width': w,
                    'height': maneuver_depth,
                    'area': w * maneuver_depth,
                    'element_id': el_id,
                    'is_auto_generated': True
                })
        
        total_area = self.length * self.width
        occupied = sum(z['area'] for z in self.zones)
        free_area = max(0, total_area - occupied)
        
        if free_area > 10:
            self.zones.append({
                'id': 'free_zone_main',
                'type': 'circulation',
                'x': 0,
                'y': 0,
                'width': self.length,
                'height': self.width,
                'area': free_area,
                'is_auto_generated': True,
                'label': 'Zona de Circulación'
            })
    
    def _recalculate_metrics(self):
        """Recalcula métricas"""
        total_area = self.length * self.width
        
        storage_area = sum(z['area'] for z in self.zones if z.get('type') == 'shelf')
        dock_area = sum(z['area'] for z in self.zones if z.get('type') in ['dock', 'dock_maneuver'])
        office_area = sum(z['area'] for z in self.zones if z.get('type') == 'office')
        aisle_area = sum(z['area'] for z in self.zones if z.get('type') in ['aisle', 'main_aisle', 'cross_aisle'])
        circulation_area = sum(z['area'] for z in self.zones if z.get('type') == 'circulation')
        
        occupied_area = storage_area + dock_area + office_area
        
        self.metrics = {
            'total_area': total_area,
            'occupied_area': occupied_area,
            'storage_area': storage_area,
            'dock_area': dock_area,
            'office_area': office_area,
            'aisle_area': aisle_area,
            'circulation_area': circulation_area,
            'free_area': total_area - occupied_area,
            'efficiency': (occupied_area / total_area * 100) if total_area > 0 else 0,
            'element_count': len(self.elements),
            'zone_count': len(self.zones)
        }


# Storage de engines por sesión
layout_engines: Dict[str, InteractiveLayoutEngine] = {}


def get_or_create_engine(session_id: str, 
                        length: float = DEFAULT_LENGTH,
                        width: float = DEFAULT_WIDTH) -> InteractiveLayoutEngine:
    """Obtiene o crea un engine para una sesión"""
    if session_id not in layout_engines:
        layout_engines[session_id] = InteractiveLayoutEngine(length, width)
        logger.info(f"🏭 Nuevo engine creado para sesión {session_id}")
    return layout_engines[session_id]


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(tags=["Interactive Layout"])


# ============================================================
# WEBSOCKET PRINCIPAL (RAILWAY + VERCEL) - CON LOGGING ULTRA-DETALLADO
# ============================================================

@router.websocket("/ws/layout/{session_id}")
async def layout_websocket(websocket: WebSocket, session_id: str):
    """WebSocket principal para edición interactiva - CON LOGGING ULTRA-DETALLADO"""
    
    logger.info("=" * 80)
    logger.info(f"🔌 WEBSOCKET HANDSHAKE INICIADO")
    logger.info(f"🔌 Session ID: {session_id}")
    logger.info(f"🔌 Cliente IP: {websocket.client.host if websocket.client else 'UNKNOWN'}")
    logger.info(f"🔌 Cliente Port: {websocket.client.port if websocket.client else 'UNKNOWN'}")
    logger.info(f"🔌 Query Params: {dict(websocket.query_params)}")
    logger.info(f"🔌 Headers RAW:")
    for key, value in websocket.headers.items():
        logger.info(f"    {key}: {value}")
    logger.info(f"🔌 Scope type: {websocket.scope.get('type')}")
    logger.info(f"🔌 Scope path: {websocket.scope.get('path')}")
    logger.info("=" * 80)
    
    user_name = websocket.query_params.get('user', 'Anónimo')
    client_id = f"{session_id}_{uuid.uuid4().hex[:8]}"
    
    logger.info(f"🔌 User name extraído: {user_name}")
    logger.info(f"🔌 Client ID generado: {client_id}")
    
    logger.info("🔌 Intentando websocket.accept()...")
    
    try:
        await websocket.accept()
        logger.info("✅ websocket.accept() EXITOSO")
    except Exception as e:
        logger.error(f"❌ ERROR en websocket.accept(): {e}", exc_info=True)
        raise
    
    logger.info("=" * 80)
    
    try:
        logger.info(f"🔌 Conectando al manager: client_id={client_id}, session={session_id}")
        connected = await manager.connect(websocket, session_id, client_id, user_name)
        
        if not connected:
            logger.error(f"❌ manager.connect() retornó False para {client_id}")
            await websocket.close(code=1011, reason="Connection failed")
            return
        
        logger.info(f"✅ manager.connect() EXITOSO para {client_id}")
        
        engine = get_or_create_engine(session_id)
        logger.info(f"✅ Engine obtenido para sesión {session_id}")
        
        users = manager.get_session_users(session_id)
        logger.info(f"📤 Enviando mensaje 'connected' con {len(users)} usuarios")
        
        await websocket.send_json({
            'type': 'connected',
            'client_id': client_id,
            'session_id': session_id,
            'online_users': users,
            'locked_elements': manager.element_locks.get(session_id, {}),
            'timestamp': datetime.now().isoformat()
        })
        
        logger.info(f"✅ Mensaje 'connected' enviado a {client_id}")
        
        message_count = 0
        while True:
            logger.debug(f"⏳ Esperando mensaje de {client_id}...")
            data = await websocket.receive_json()
            message_count += 1
            logger.info(f"📨 Mensaje #{message_count} recibido de {client_id}: {data.get('type') or data.get('action', 'unknown')}")
            
            response = await handle_websocket_message(data, session_id, client_id, engine)
            
            if response:
                logger.info(f"📤 Enviando respuesta tipo '{response.get('type')}' a {client_id}")
                await websocket.send_json(response)
    
    except WebSocketDisconnect as e:
        logger.info(f"🔌 WebSocket desconectado normalmente: {client_id}, code={e.code}")
    except Exception as e:
        logger.error(f"❌ Error en WebSocket {client_id}: {e}", exc_info=True)
        try:
            await websocket.send_json({'type': 'error', 'code': 'INTERNAL_ERROR', 'message': str(e)})
        except:
            logger.warning(f"⚠️ No se pudo enviar error a {client_id}")
    finally:
        logger.info(f"🧹 Limpiando conexión de {client_id}")
        manager.disconnect(client_id)
        
        users = manager.get_session_users(session_id)
        logger.info(f"📢 Broadcasting user_left a sesión {session_id} ({len(users)} usuarios restantes)")
        await manager.broadcast_to_session(
            session_id,
            {
                'type': 'user_left',
                'client_id': client_id,
                'users': users
            }
        )
        logger.info(f"✅ Cleanup completado para {client_id}")


# ============================================================
# RUTA ALTERNATIVA
# ============================================================

@router.websocket("/realtime/layout/{session_id}")
async def layout_websocket_alt(websocket: WebSocket, session_id: str):
    """Ruta alternativa - redirige a la handler principal"""
    logger.info(f"🔄 Ruta alternativa /realtime/layout/{session_id}")
    await layout_websocket(websocket, session_id)


# ============================================================
# MESSAGE HANDLERS - CORREGIDOS
# ============================================================


# ============================================================
# NORMALIZADORES DE PROTOCOLO (COMPAT CAMELCASE / LEGACY)
# ============================================================

def _norm_element_id(data: dict) -> Optional[str]:
    return (
        data.get('element_id')
        or data.get('elementId')
        or data.get('elementID')
        or data.get('id')
    )

def _norm_position(data: dict) -> Dict[str, float]:
    # Preferido legacy: position: {x,y}
    pos = data.get('position') or {}
    x = None
    y = None

    if isinstance(pos, dict):
        x = pos.get('x')
        y = pos.get('y')

    # Compat plano: x,y
    if x is None:
        x = data.get('x')
    if y is None:
        y = data.get('y')

    try:
        x = float(x) if x is not None else 0.0
    except Exception:
        x = 0.0
    try:
        y = float(y) if y is not None else 0.0
    except Exception:
        y = 0.0

    return {'x': x, 'y': y}

def _norm_message_type(data: dict) -> str:
    # Preferido en este archivo: type (legacy) / action (nuevo)
    t = data.get('type')
    if t:
        return str(t)
    if data.get('action'):
        return 'action'
    return ''
async def handle_websocket_message(data: dict, session_id: str, client_id: str, engine: InteractiveLayoutEngine) -> Optional[dict]:
    """Manejador central de mensajes"""
    message_type = _norm_message_type(data)

    # Compat: tipos legacy que realmente son acciones
    if message_type in ('move_request', 'move', 'lock', 'unlock', 'select', 'deselect', 'cursor'):
        # Normalizamos a canal de acciones
        if 'action' not in data:
            data['action'] = 'move' if message_type in ('move_request', 'move') else message_type
        message_type = 'action'

    logger.debug(f"🔄 Procesando mensaje tipo: {message_type}")
    
    if message_type == 'initialize':
        return await handle_initialize(data, session_id, engine)
    
    elif message_type == 'action':
        return await handle_action(data, session_id, client_id, engine)
    
    elif message_type == 'cursor_update':
        return await handle_cursor(data, session_id, client_id)
    
    elif message_type == 'ping':
        logger.debug(f"🏓 Ping recibido de {client_id}")
        return {'type': 'pong', 'timestamp': datetime.now().isoformat()}
    
    else:
        logger.warning(f"⚠️ Tipo de mensaje desconocido: {data}")
        return {'type': 'error', 'message': f'Tipo desconocido: {message_type}'}


# ============================================================
# CORRECCIÓN CRÍTICA: handle_action con llamada a 'move'
# ============================================================

async def handle_action(data: dict, session_id: str, client_id: str, engine: InteractiveLayoutEngine) -> dict:
    """Procesa acciones del engine - AHORA CON 'move'"""
    action = data.get('action')
    element_id = _norm_element_id(data)
    
    logger.info(f"🎬 Acción '{action}' de {client_id} en elemento {element_id}")
    
    # ✅ PING/PONG - Heartbeat del frontend
    if action == 'ping':
        logger.debug(f"🏓 Ping recibido de {client_id} (vía action)")
        return {'type': 'pong', 'timestamp': datetime.now().isoformat()}
    
    elif action == 'pong':
        logger.debug(f"🏓 Pong recibido de {client_id}")
        return None  # No responder
    
    elif action == 'init':
        return await handle_init(data, session_id, client_id, engine)
    
    # ========================================================
    # CORRECCIÓN CRÍTICA: Añadido caso 'move'
    # ========================================================
    elif action == 'move':
        return await handle_move(data, session_id, client_id, engine)
    
    elif action == 'select':
        return await handle_select(data, session_id, client_id)
    
    elif action == 'deselect' or action == 'unlock':
        return await handle_deselect(data, session_id, client_id)
    
    elif action == 'lock':
        return await handle_lock(data, session_id, client_id)
    
    elif action == 'add':
        return await handle_add(data, session_id, client_id, engine)
    
    elif action == 'delete':
        return await handle_delete(data, session_id, client_id, engine)
    
    elif action == 'resize':
        return await handle_resize(data, session_id, client_id, engine)
    
    elif action == 'rotate':
        return await handle_rotate(data, session_id, client_id, engine)
    
    elif action == 'cursor':
        return await handle_cursor(data, session_id, client_id)
    
    elif action == 'get_state':
        result = engine.get_state()
        return {**result, 'type': 'state'}
    
    elif action == 'reset':
        return await handle_reset(data, session_id, client_id, engine)
    
    elif action == 'chat':
        return await handle_chat(data, session_id, client_id)
    
    else:
        logger.warning(f"⚠️ Acción desconocida: {action}")
        return {'type': 'error', 'message': f'Acción desconocida: {action}'}


# ============================================================
# CORRECCIÓN CRÍTICA: handle_move implementado correctamente
# ============================================================

async def handle_move(data: dict, session_id: str, client_id: str, engine: InteractiveLayoutEngine) -> dict:
    """Maneja acción move - COMPLETAMENTE REESCRITO CON LOGGING

    Compatibilidad de protocolo:
    - element_id / elementId
    - position:{x,y} o x,y planos
    - ts / timestamp (se ignora en backend, pero se conserva si llega)
    """
    element_id = _norm_element_id(data)
    pos = _norm_position(data)
    x = float(pos.get('x', 0))
    y = float(pos.get('y', 0))
    
    logger.info(f"📦 Move: {element_id} → ({x:.2f}, {y:.2f}) por {client_id}")
    
    # 1. Verificar elemento existe
    if element_id not in engine.elements:
        logger.warning(f"⚠️ Elemento {element_id} no existe en el engine")
        return {
            'type': 'error',
            'message': f'Elemento {element_id} no encontrado'
        }
    
    # 2. Intentar bloquear elemento (permitir si ya está bloqueado por este cliente)
    can_lock = await manager.try_lock_element(session_id, element_id, client_id)
    if not can_lock and engine.elements[element_id].get('locked_by') != client_id:
        logger.warning(f"🔒 Elemento {element_id} bloqueado, rechazando move de {client_id}")
        return {
            'type': 'error',
            'code': 'ELEMENT_LOCKED',
            'message': f'Elemento {element_id} está siendo editado por otro usuario'
        }
    
    # 3. Mover elemento usando el engine
    result = await engine.move_element(element_id, x, y)
    
    if 'error' in result:
        logger.error(f"❌ Error moviendo elemento: {result['error']}")
        return {'type': 'error', 'message': result['error']}
    
    # 4. Preparar datos para broadcast
    users = manager.get_session_users(session_id)
    
    # 5. Broadcast 'element_moved' a OTROS usuarios (exclude sender)
    logger.info(f"📢 Broadcasting element_moved a sesión {session_id}")
    await manager.broadcast_to_session(
        session_id,
        {
            'type': 'element_moved',
            'by_client': client_id,
            'by_client_id': client_id,  # alias
            'element_id': element_id,
            'elementId': element_id,  # alias camelCase
            'x': x,
            'y': y,
            'position': {'x': x, 'y': y},
            'element': result.get('element'),
            'zones': result.get('zones', []),
            'metrics': result.get('metrics', {}),
            'users': users
        },
        exclude=client_id  # NO enviar al remitente
    )
    
    # 6. Devolver 'move_ack' SOLO al cliente que movió
    # Esto actualiza su UI y confirma el movimiento
    logger.info(f"📤 Envíando move_ack a cliente {client_id}")
    return {
        'type': 'move_ack', 
        'element_id': element_id,
        'elementId': element_id,  # alias
        'x': x,
        'y': y,
        'position': {'x': x, 'y': y},
        'zones': result.get('zones', []),
        'metrics': result.get('metrics', {}),
        'warnings': result.get('warnings', []),
        'can_undo': True,
        'can_redo': False
    }


async def handle_select(data: dict, session_id: str, client_id: str) -> dict:
    """Maneja acción select - Ahora bloquea correctamente"""
    element_id = _norm_element_id(data)
    
    logger.info(f"🔒 Select: {element_id} por {client_id}")
    
    # Verificar si ya está bloqueado por otro
    if session_id in manager.element_locks:
        locks = manager.element_locks[session_id]
        if element_id in locks and locks[element_id] != client_id:
            locking_client = manager.clients.get(locks[element_id])
            locking_user = locking_client.user_name if locking_client else 'Otro usuario'
            
            return {
                'type': 'error',
                'code': 'ELEMENT_LOCKED',
                'message': f'Elemento bloqueado por {locking_user}'
            }
    
    # Intentar bloquear
    can_lock = await manager.try_lock_element(session_id, element_id, client_id)
    engine = get_or_create_engine(session_id)
    
    if can_lock:
        # Marcar como seleccionado en el engine
        if element_id in engine.elements:
            engine.elements[element_id]['locked_by'] = client_id
        
        users = manager.get_session_users(session_id)
        
        logger.info(f"✅ Elemento {element_id} bloqueado por {client_id}")
        await manager.broadcast_to_session(
            session_id,
            {
                'type': 'element_locked',
                'element_id': element_id,
                'client_id': client_id,
                'users': users
            }
        )
        return {'type': 'select_ack', 'locked': True}
    else:
        return {
            'type': 'error',
            'code': 'ELEMENT_LOCKED',
            'message': 'Elemento está siendo editado por otro usuario'
        }


async def handle_deselect(data: dict, session_id: str, client_id: str) -> dict:
    """Maneja acción deselect"""
    element_id = _norm_element_id(data)
    
    logger.info(f"🔓 Deselect: {element_id} por {client_id}")
    
    manager.unlock_element(client_id, element_id)
    
    # Limpiar lock en engine
    engine = get_or_create_engine(session_id)
    if element_id in engine.elements and 'locked_by' in engine.elements[element_id]:
        del engine.elements[element_id]['locked_by']
    
    users = manager.get_session_users(session_id)
    
    await manager.broadcast_to_session(
        session_id,
        {
            'type': 'element_unlocked',
            'element_id': element_id,
            'client_id': client_id,
            'users': users
        }
    )
    
    return {'type': 'deselect_ack', 'success': True}


async def handle_cursor(data: dict, session_id: str, client_id: str) -> Optional[dict]:
    """Maneja actualización de cursor (compat x,y plano o position:{x,y})."""
    pos = _norm_position(data)
    x = pos.get('x', 0.0)
    y = pos.get('y', 0.0)

    manager.update_cursor(client_id, x, y)

    # Emitimos formato NUEVO + legacy para no romper el frontend
    payload = {
        'type': 'cursor_update',
        'client_id': client_id,
        'cursor_position': {'x': x, 'y': y},
        'position': {'x': x, 'y': y},  # legacy
    }
    await manager.broadcast_to_session(session_id, payload, exclude=client_id)

    # Legacy extra (si alguna parte escucha cursor_move)
    await manager.broadcast_to_session(
        session_id,
        {
            'type': 'cursor_move',
            'client_id': client_id,
            'position': {'x': x, 'y': y}
        },
        exclude=client_id
    )

    return None



async def handle_init(data: dict, session_id: str, client_id: str, engine: InteractiveLayoutEngine) -> dict:
    """Inicializa el layout desde el frontend"""
    elements = data.get('elements', [])
    dimensions = data.get('dimensions', {})
    
    logger.info(f"🏭 Init desde {client_id}: {len(elements)} elementos")
    
    if dimensions:
        engine.length = dimensions.get('length', engine.length)
        engine.width = dimensions.get('width', engine.width)
    
    result = engine.initialize_from_elements(elements)
    
    users = manager.get_session_users(session_id)
    
    # Broadcast state_update a todos
    logger.info(f"📢 Broadcasting state_update a sesión {session_id}")
    await manager.broadcast_to_session(
        session_id,
        {
            'type': 'state_update',
            'elements': result.get('elements', elements),
            'zones': result.get('zones', []),
            'metrics': result.get('metrics', {}),
            'users': users
        }
    )
    
    return {
        'type': 'initialized',
        'zones': result.get('zones', []),
        'metrics': result.get('metrics', {}),
        'warnings': [],
        'can_undo': False,
        'can_redo': False
    }


async def handle_lock(data: dict, session_id: str, client_id: str) -> dict:
    """Maneja acción lock (bloquear elemento)"""
    element_id = _norm_element_id(data)
    
    logger.info(f"🔒 Lock request: {element_id} por {client_id}")
    
    can_lock = await manager.try_lock_element(session_id, element_id, client_id)
    
    return {
        'type': 'lock_result',
        'element_id': element_id,
        'elementId': element_id,  # alias
        'success': can_lock,
        'locked_by': client_id if can_lock else None,
        'lockedBy': client_id if can_lock else None,  # alias
        'client_id': client_id
    }


async def handle_add(data: dict, session_id: str, client_id: str, engine: InteractiveLayoutEngine) -> dict:
    """Añade un nuevo elemento"""
    element = data.get('element', {})
    
    if not element:
        return {'type': 'error', 'message': 'No se proporcionó elemento'}
    
    if 'id' not in element:
        element['id'] = f"el_{uuid.uuid4().hex[:8]}"
    
    element_id = element['id']
    
    logger.info(f"➕ Add element: {element_id} por {client_id}")
    
    # Añadir al engine
    engine.elements[element_id] = {
        'id': element_id,
        'type': element.get('type', 'unknown'),
        'position': element.get('position', {'x': 0, 'y': 0}),
        'dimensions': element.get('dimensions', {'width': 1, 'length': 1}),
        'rotation': element.get('rotation', 0),
        'properties': element.get('properties', {}),
        'layer': element.get('layer', 'default')
    }
    
    # Recalcular
    engine._recalculate_all()
    
    users = manager.get_session_users(session_id)
    
    # Broadcast
    await manager.broadcast_to_session(
        session_id,
        {
            'type': 'element_added',
            'element': engine.elements[element_id],
            'elements': list(engine.elements.values()),
            'zones': engine.zones,
            'metrics': engine.metrics,
            'users': users,
            'online_users': users,
            'source_client': client_id
        }
    )
    
    return {'type': 'add_ack', 'success': True, 'element_id': element_id}


async def handle_delete(data: dict, session_id: str, client_id: str, engine: InteractiveLayoutEngine) -> dict:
    """Elimina un elemento"""
    element_id = _norm_element_id(data)
    
    if not element_id:
        return {'type': 'error', 'message': 'No se proporcionó element_id'}
    
    if element_id not in engine.elements:
        return {'type': 'error', 'message': f'Elemento {element_id} no encontrado'}
    
    logger.info(f"🗑️ Delete element: {element_id} por {client_id}")
    
    # Verificar que no esté bloqueado por otro
    can_lock = await manager.try_lock_element(session_id, element_id, client_id)
    if not can_lock:
        return {
            'type': 'error',
            'code': 'ELEMENT_LOCKED',
            'message': f'Elemento {element_id} está bloqueado por otro usuario'
        }
    
    # Eliminar
    del engine.elements[element_id]
    
    # Desbloquear
    manager.unlock_element(client_id, element_id)
    
    # Recalcular
    engine._recalculate_all()
    
    users = manager.get_session_users(session_id)
    
    # Broadcast
    await manager.broadcast_to_session(
        session_id,
        {
            'type': 'element_deleted',
            'element_id': element_id,
            'elements': list(engine.elements.values()),
            'zones': engine.zones,
            'metrics': engine.metrics,
            'users': users,
            'online_users': users,
            'source_client': client_id
        }
    )
    
    return {'type': 'delete_ack', 'success': True, 'element_id': element_id}


async def handle_resize(data: dict, session_id: str, client_id: str, engine: InteractiveLayoutEngine) -> dict:
    """Redimensiona un elemento"""
    element_id = _norm_element_id(data)
    dimensions = data.get('dimensions', {})
    
    if not element_id or element_id not in engine.elements:
        return {'type': 'error', 'message': f'Elemento {element_id} no encontrado'}
    
    logger.info(f"📐 Resize: {element_id} → {dimensions} por {client_id}")
    
    # Verificar lock
    can_lock = await manager.try_lock_element(session_id, element_id, client_id)
    if not can_lock:
        return {
            'type': 'error',
            'code': 'ELEMENT_LOCKED',
            'message': f'Elemento {element_id} está bloqueado'
        }
    
    # Actualizar dimensiones
    if 'width' in dimensions:
        engine.elements[element_id]['dimensions']['width'] = dimensions['width']
    if 'height' in dimensions:
        engine.elements[element_id]['dimensions']['height'] = dimensions['height']
    if 'length' in dimensions:
        engine.elements[element_id]['dimensions']['length'] = dimensions['length']
    if 'depth' in dimensions:
        engine.elements[element_id]['dimensions']['depth'] = dimensions['depth']
    
    # Recalcular
    engine._recalculate_all()
    
    users = manager.get_session_users(session_id)
    
    # Broadcast
    await manager.broadcast_to_session(
        session_id,
        {
            'type': 'element_resized',
            'element_id': element_id,
            'element': engine.elements[element_id],
            'elements': list(engine.elements.values()),
            'zones': engine.zones,
            'metrics': engine.metrics,
            'users': users,
            'online_users': users,
            'source_client': client_id
        }
    )
    
    return {'type': 'resize_ack', 'success': True}


async def handle_rotate(data: dict, session_id: str, client_id: str, engine: InteractiveLayoutEngine) -> dict:
    """Rota un elemento"""
    element_id = _norm_element_id(data)
    rotation = data.get('rotation', 0)
    
    if not element_id or element_id not in engine.elements:
        return {'type': 'error', 'message': f'Elemento {element_id} no encontrado'}
    
    logger.info(f"🔄 Rotate: {element_id} → {rotation}° por {client_id}")
    
    # Verificar lock
    can_lock = await manager.try_lock_element(session_id, element_id, client_id)
    if not can_lock:
        return {
            'type': 'error',
            'code': 'ELEMENT_LOCKED',
            'message': f'Elemento {element_id} está bloqueado'
        }
    
    # Actualizar rotación
    engine.elements[element_id]['rotation'] = rotation
    
    # Recalcular
    engine._recalculate_all()
    
    users = manager.get_session_users(session_id)
    
    # Broadcast
    await manager.broadcast_to_session(
        session_id,
        {
            'type': 'element_rotated',
            'element_id': element_id,
            'rotation': rotation,
            'element': engine.elements[element_id],
            'zones': engine.zones,
            'metrics': engine.metrics,
            'users': users,
            'online_users': users,
            'source_client': client_id
        }
    )
    
    return {'type': 'rotate_ack', 'success': True}


async def handle_chat(data: dict, session_id: str, client_id: str) -> dict:
    """Maneja mensajes de chat"""
    message = data.get('message', '')
    
    if not message:
        return None
    
    client_info = manager.clients.get(client_id)
    user_name = client_info.user_name if client_info else 'Anónimo'
    
    logger.info(f"💬 Chat de {user_name}: {message[:50]}...")
    
    # Broadcast a todos
    await manager.broadcast_to_session(
        session_id,
        {
            'type': 'chat_message',
            'client_id': client_id,
            'user_name': user_name,
            'message': message,
            'timestamp': datetime.now().isoformat()
        }
    )
    
    return None


async def handle_reset(data: dict, session_id: str, client_id: str, engine: InteractiveLayoutEngine) -> dict:
    """Resetea el layout"""
    logger.info(f"🔄 Reset layout por {client_id}")
    
    # Limpiar elementos
    engine.elements = {}
    engine.zones = []
    engine.metrics = {}
    
    users = manager.get_session_users(session_id)
    
    # Broadcast
    await manager.broadcast_to_session(
        session_id,
        {
            'type': 'state_update',
            'elements': [],
            'zones': [],
            'metrics': {},
            'users': users,
            'online_users': users,
            'source': 'reset',
            'source_client': client_id
        }
    )
    
    return {'type': 'reset_ack', 'success': True}


# ============================================================
# REST ENDPOINTS (Vercel Fallback)
# ============================================================

class MoveRequest(BaseModel):
    element_id: str
    position: Dict[str, float]


@router.post("/api/layout/move/{session_id}")
async def move_element_rest(session_id: str, request: MoveRequest):
    """Mueve un elemento (REST fallback)"""
    logger.info(f"📡 REST move: session={session_id}, element={request.element_id}")
    
    if session_id not in layout_engines:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    
    engine = layout_engines[session_id]
    result = await engine.move_element(request.element_id, request.position['x'], request.position['y'])
    
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    
    return result


@router.get("/api/layout/state/{session_id}")
async def get_state_rest(session_id: str):
    """Obtiene estado actual"""
    logger.info(f"📡 REST get_state: session={session_id}")
    
    if session_id not in layout_engines:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    
    engine = layout_engines[session_id]
    return engine.get_state()


@router.get("/api/sessions/stats")
async def get_stats():
    """Estadísticas de producción"""
    stats = {
        'total_clients': len(manager.clients),
        'total_sessions': len(manager.sessions),
        'sessions': {sid: len(clients) for sid, clients in manager.sessions.items()}
    }
    logger.info(f"📊 Stats: {stats}")
    return stats


# ============================================================
# HEALTH CHECKS
# ============================================================

@router.get("/health")
async def health_check():
    """Health check para Railway"""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "connections": len(manager.clients),
        "sessions": len(layout_engines)
    }


@router.get("/ws/health")
async def ws_health_check():
    """Health check específico para WebSocket"""
    return {
        "status": "ok",
        "websocket": "enabled",
        "timestamp": datetime.now().isoformat(),
        "active_sessions": len(layout_engines),
        "active_clients": len(manager.clients),
        "routes": ["/ws/layout/{session_id}", "/realtime/layout/{session_id}"]
    }


@router.get("/ws/sessions")
async def list_sessions():
    """Lista sesiones activas"""
    return {
        "sessions": [
            {
                "session_id": sid,
                "users_count": len(clients),
                "users": manager.get_session_users(sid)
            }
            for sid, clients in manager.sessions.items()
        ],
        "total_sessions": len(manager.sessions)
    }


# ============================================================
# LOG DE CARGA
# ============================================================

logger.info("=" * 60)
logger.info("✅ websocket_routes.py V2.1 CARGADO")
logger.info("   ✅ WebSocketManager: INLINE")
logger.info("   ✅ InteractiveLayoutEngine: INLINE")
logger.info("   ✅ Sin dependencias externas")
logger.info("   ✅ Handler 'move' IMPLEMENTADO")
logger.info("   Rutas WebSocket:")
logger.info("   - /ws/layout/{session_id}")
logger.info("   - /realtime/layout/{session_id}")
logger.info("   Rutas REST:")
logger.info("   - /api/layout/move/{session_id}")
logger.info("   - /api/layout/state/{session_id}")
logger.info("   - /api/sessions/stats")
logger.info("   Health:")
logger.info("   - /health")
logger.info("   - /ws/health")
logger.info("   - /ws/sessions")
logger.info("=" * 60)