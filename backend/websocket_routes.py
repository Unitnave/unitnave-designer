"""
UNITNAVE Designer - WebSocket Routes (V1.3 PRODUCTION + LOGGING)
Endpoints WebSocket para edición interactiva en tiempo real.
"""

import os
import uuid
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

from websocket_manager import manager
from interactive_layout_engine import InteractiveLayoutEngine, layout_engines

logger = logging.getLogger(__name__)

# ============================================================
# CONFIGURACIÓN DE PRODUCCIÓN
# ============================================================

DEFAULT_LENGTH = float(os.getenv("WAREHOUSE_LENGTH", 80))
DEFAULT_WIDTH = float(os.getenv("WAREHOUSE_WIDTH", 40))

# ============================================================
# STORAGE DE ENGINES
# ============================================================

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
    """WebSocket principal para edición interactiva"""
    
    logger.info("=" * 80)
    logger.info(f"🔌 WEBSOCKET HANDSHAKE INICIADO")
    logger.info(f"🔌 Session ID: {session_id}")
    logger.info(f"🔌 Cliente IP: {websocket.client.host if websocket.client else 'UNKNOWN'}")
    logger.info(f"🔌 Query Params: {dict(websocket.query_params)}")
    logger.info(f"🔌 Headers RAW:")
    for key, value in websocket.headers.items():
        logger.info(f"    {key}: {value}")
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
            logger.debug(f"📨 Contenido completo: {data}")
            
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
# RUTA ALTERNATIVA (por si el frontend usa otra URL)
# ============================================================

@router.websocket("/realtime/layout/{session_id}")
async def layout_websocket_alt(websocket: WebSocket, session_id: str):
    """Ruta alternativa - redirige a la handler principal"""
    logger.info(f"🔄 Ruta alternativa /realtime/layout/{session_id} - redirigiendo a handler principal")
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
        return {'type': 'pong'}
    
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
    """Procesa acciones del engine (move, select, etc.)"""
    action = data.get('action')
    element_id = data.get('element_id')
    
    logger.info(f"🎬 Acción '{action}' de {client_id} en elemento {element_id}")
    
    if action == 'move':
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
    """Maneja acción select (bloquear elemento)"""
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
    """Maneja acción deselect (desbloquear elemento)"""
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


async def handle_cursor(data: dict, session_id: str, client_id: str) -> dict:
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
    """Mueve un elemento (REST fallback para Vercel)"""
    logger.info(f"📡 REST move: session={session_id}, element={request.element_id}")
    
    if session_id not in layout_engines:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    
    engine = layout_engines[session_id]
    result = engine.move_element(request.element_id, request.position['x'], request.position['y'])
    
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    
    return result

@router.get("/api/layout/state/{session_id}")
async def get_state_rest(session_id: str):
    """Obtiene estado actual (Vercel)"""
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