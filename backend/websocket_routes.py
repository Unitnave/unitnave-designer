"""
UNITNAVE Designer - WebSocket Routes V2.0 PRODUCTION
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
# LOGGING
# ============================================================

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
    
    def update_cursor(self, client_id: str, x: float, y: float):
        """Actualiza posición del cursor"""
        if client_id in self.clients:
            self.clients[client_id].cursor_x = x
            self.clients[client_id].cursor_y = y
    
    def get_session_users(self, session_id: str) -> List[dict]:
        """Obtiene lista de usuarios en una sesión"""
        users = []
        if session_id in self.sessions:
            for client_id in self.sessions[session_id]:
                if client_id in self.clients:
                    info = self.clients[client_id]
                    users.append({
                        'client_id': client_id,
                        'user_name': info.user_name,
                        'cursor': {'x': info.cursor_x, 'y': info.cursor_y},
                        'locked_elements': list(info.locked_elements)
                    })
        return users


# Instancia global del manager
manager = WebSocketManager()


# ============================================================
# INTERACTIVE LAYOUT ENGINE (INCLUIDO AQUÍ - NO IMPORT EXTERNO)
# ============================================================

class InteractiveLayoutEngine:
    """Engine simplificado para layout interactivo - INCLUIDO INLINE"""
    
    def __init__(self, length: float = 80, width: float = 40):
        self.length = length
        self.width = width
        self.elements: Dict[str, dict] = {}
        self.zones: List[dict] = []
        self.metrics: dict = {}
        logger.info(f"✅ InteractiveLayoutEngine creado: {length}x{width}")
    
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
                'properties': el.get('properties', {})
            }
        
        self._recalculate_zones()
        self._recalculate_metrics()
        
        return {
            'elements': list(self.elements.values()),
            'zones': self.zones,
            'metrics': self.metrics
        }
    
    async def move_element(self, element_id: str, x: float, y: float) -> dict:
        """Mueve un elemento a nueva posición"""
        if element_id not in self.elements:
            return {'error': f'Elemento {element_id} no encontrado'}
        
        # Validar límites
        x = max(0, min(x, self.length))
        y = max(0, min(y, self.width))
        
        self.elements[element_id]['position'] = {'x': x, 'y': y}
        
        self._recalculate_zones()
        self._recalculate_metrics()
        
        return {
            'success': True,
            'element': self.elements[element_id],
            'zones': self.zones,
            'metrics': self.metrics
        }
    
    def get_state(self) -> dict:
        """Retorna estado actual"""
        return {
            'elements': list(self.elements.values()),
            'zones': self.zones,
            'metrics': self.metrics,
            'dimensions': {'length': self.length, 'width': self.width}
        }
    
    def _recalculate_zones(self):
        """Recalcula zonas (simplificado)"""
        self.zones = [
            {
                'id': 'storage_zone',
                'type': 'storage',
                'area': self.length * self.width * 0.6
            },
            {
                'id': 'circulation_zone',
                'type': 'circulation',
                'area': self.length * self.width * 0.3
            },
            {
                'id': 'services_zone',
                'type': 'services',
                'area': self.length * self.width * 0.1
            }
        ]
    
    def _recalculate_metrics(self):
        """Recalcula métricas"""
        total_area = self.length * self.width
        elements_area = sum(
            el.get('dimensions', {}).get('width', 1) * el.get('dimensions', {}).get('length', 1)
            for el in self.elements.values()
        )
        
        self.metrics = {
            'total_area': total_area,
            'used_area': elements_area,
            'free_area': total_area - elements_area,
            'utilization': (elements_area / total_area * 100) if total_area > 0 else 0,
            'element_count': len(self.elements)
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
# WEBSOCKET PRINCIPAL (RAILWAY + VERCEL) - CON LOGGING DETALLADO
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
            'locked_elements': {}
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
# MESSAGE HANDLERS
# ============================================================

async def handle_websocket_message(data: dict, session_id: str, client_id: str, engine: InteractiveLayoutEngine) -> Optional[dict]:
    """Manejador central de mensajes"""
    message_type = data.get('type')
    
    if message_type is None and data.get('action'):
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


async def handle_initialize(data: dict, session_id: str, engine: InteractiveLayoutEngine) -> dict:
    """Inicializa el layout"""
    elements = data.get('elements', [])
    dimensions = data.get('dimensions', {})
    
    logger.info(f"🏭 Inicializando layout: {len(elements)} elementos, dims={dimensions}")
    
    if dimensions:
        engine.length = dimensions.get('length', engine.length)
        engine.width = dimensions.get('width', engine.width)
    
    result = engine.initialize_from_elements(elements)
    
    users = manager.get_session_users(session_id)
    
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
    
    return {'type': 'initialized', 'success': True}


async def handle_action(data: dict, session_id: str, client_id: str, engine: InteractiveLayoutEngine) -> dict:
    """Procesa acciones del engine"""
    action = data.get('action')
    element_id = data.get('element_id')
    
    logger.info(f"🎬 Acción '{action}' de {client_id} en elemento {element_id}")
    
    # ✅ PING/PONG - Heartbeat del frontend
    if action == 'ping':
        logger.debug(f"🏓 Ping recibido de {client_id} (vía action)")
        return {'type': 'pong', 'timestamp': datetime.now().isoformat()}
    
    elif action == 'move':
        return await handle_move(data, session_id, client_id, engine)
    
    elif action == 'select':
        return await handle_select(data, session_id, client_id)
    
    elif action == 'deselect':
        return await handle_deselect(data, session_id, client_id)
    
    elif action == 'get_state':
        result = engine.get_state()
        return {**result, 'type': 'state'}
    
    else:
        logger.warning(f"⚠️ Acción desconocida: {action}")
        return {'type': 'error', 'message': f'Acción desconocida: {action}'}


async def handle_move(data: dict, session_id: str, client_id: str, engine: InteractiveLayoutEngine) -> dict:
    """Maneja acción move"""
    element_id = data.get('element_id')
    position = data.get('position', {})
    x = float(position.get('x', 0))
    y = float(position.get('y', 0))
    
    logger.info(f"📦 Move: {element_id} -> ({x}, {y}) por {client_id}")
    
    can_lock = await manager.try_lock_element(session_id, element_id, client_id)
    if not can_lock:
        logger.warning(f"🔒 Elemento {element_id} bloqueado, rechazando move de {client_id}")
        return {
            'type': 'error',
            'code': 'ELEMENT_LOCKED',
            'message': f'Elemento {element_id} está bloqueado'
        }
    
    result = await engine.move_element(element_id, x, y)
    
    if 'error' in result:
        logger.error(f"❌ Error moviendo elemento: {result['error']}")
        return result
    
    users = manager.get_session_users(session_id)
    
    logger.info(f"📢 Broadcasting element_moved a sesión {session_id}")
    await manager.broadcast_to_session(
        session_id,
        {
            'type': 'element_moved',
            'element_id': element_id,
            'position': {'x': x, 'y': y},
            'zones': result.get('zones', []),
            'metrics': result.get('metrics', {}),
            'users': users
        }
    )
    
    return {'type': 'move_ack', 'success': True}


async def handle_select(data: dict, session_id: str, client_id: str) -> dict:
    """Maneja acción select"""
    element_id = data.get('element_id')
    
    logger.info(f"🔒 Select: {element_id} por {client_id}")
    
    can_lock = await manager.try_lock_element(session_id, element_id, client_id)
    
    users = manager.get_session_users(session_id)
    
    if can_lock:
        client_info = manager.clients.get(client_id)
        user_name = client_info.user_name if client_info else 'Unknown'
        
        logger.info(f"✅ Elemento {element_id} bloqueado por {client_id} ({user_name})")
        await manager.broadcast_to_session(
            session_id,
            {
                'type': 'element_locked',
                'element_id': element_id,
                'client_id': client_id,
                'user_name': user_name,
                'users': users
            }
        )
        return {'type': 'select_ack', 'locked': True}
    else:
        logger.warning(f"❌ No se pudo bloquear {element_id} para {client_id}")
        return {
            'type': 'error',
            'code': 'ELEMENT_LOCKED',
            'message': f'Elemento {element_id} está siendo editado por otro usuario'
        }


async def handle_deselect(data: dict, session_id: str, client_id: str) -> dict:
    """Maneja acción deselect"""
    element_id = data.get('element_id')
    
    logger.info(f"🔓 Deselect: {element_id} por {client_id}")
    
    manager.unlock_element(client_id, element_id)
    
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
    """Maneja actualización de cursor"""
    x = data.get('x', 0)
    y = data.get('y', 0)
    
    manager.update_cursor(client_id, x, y)
    
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
logger.info("✅ websocket_routes.py V2.0 CARGADO")
logger.info("   ✅ WebSocketManager: INLINE")
logger.info("   ✅ InteractiveLayoutEngine: INLINE")
logger.info("   ✅ Sin dependencias externas")
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