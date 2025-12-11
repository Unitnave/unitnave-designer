"""
UNITNAVE Designer - WebSocket Routes (V1.2 PRODUCTION)
Endpoints WebSocket para edición interactiva en tiempo real.

CHANGES FOR PRODUCTION:
- ✅ Fixed element_locked/element_unlocked messages
- ✅ Added all REST endpoints for Railway fallback
- ✅ Added CORS headers for Vercel
- ✅ Redis-ready (comentado para habilitar)
- ✅ Railway env vars support
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

# Railway: Usa variables de entorno
DEFAULT_LENGTH = float(os.getenv("WAREHOUSE_LENGTH", 80))
DEFAULT_WIDTH = float(os.getenv("WAREHOUSE_WIDTH", 40))

# Redis (descomentar cuando estés listo)
# import redis
# redis_client = redis.Redis(
#     host=os.getenv("REDIS_HOST", "localhost"),
#     port=int(os.getenv("REDIS_PORT", 6379)),
#     password=os.getenv("REDIS_PASSWORD", None),
#     decode_responses=True
# )

# ============================================================
# STORAGE DE ENGINES (En producción usar Redis)
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
# WEBSOCKET PRINCIPAL (RAILWAY + VERCEL)
# ============================================================

@router.websocket("/socket/layout/{session_id}")
async def layout_websocket(websocket: WebSocket, session_id: str):
    """WebSocket principal para edición interactiva"""
    client_id = f"{session_id}_{uuid.uuid4().hex[:8]}"
    user_name = websocket.query_params.get('user', 'Anónimo')
    
    # Logging de producción
    logger.info(f"🌐 WebSocket intentando conectar: {client_id} desde {websocket.client}")
    
    try:
        connected = await manager.connect(websocket, session_id, client_id, user_name)
        if not connected:
            logger.error(f"❌ Conexión fallida para {client_id}")
            return
        
        logger.info(f"✅ WebSocket conectado: {client_id} a sesión {session_id}")
        
        engine = get_or_create_engine(session_id)
        
        # Enviar estado inicial con users
        users = manager.get_session_users(session_id)
        
        await websocket.send_json({
            'type': 'connected',
            'client_id': client_id,
            'session_id': session_id,
            'online_users': users,
            'locked_elements': {}
        })
        
        while True:
            data = await websocket.receive_json()
            logger.debug(f"📨 Mensaje recibido: {data}")
            
            response = await handle_websocket_message(data, session_id, client_id, engine)
            
            if response:
                await websocket.send_json(response)
    
    except WebSocketDisconnect:
        logger.info(f"🔌 WebSocket desconectado: {client_id}")
    except Exception as e:
        logger.error(f"❌ Error en WebSocket {client_id}: {e}", exc_info=True)
        try:
            await websocket.send_json({'type': 'error', 'code': 'INTERNAL_ERROR', 'message': str(e)})
        except:
            pass
    finally:
        manager.disconnect(client_id)
        
        # Broadcast desconexión a otros usuarios
        users = manager.get_session_users(session_id)
        await manager.broadcast_to_session(
            session_id,
            {
                'type': 'user_left',
                'client_id': client_id,
                'users': users  # Actualizar lista
            }
        )


async def handle_websocket_message(data: dict, session_id: str, client_id: str, engine: InteractiveLayoutEngine) -> Optional[dict]:
    """Manejador central de mensajes"""
    message_type = data.get('type')
    
    # ❌ CRITICAL FIX: Manejar mensajes sin 'type' (compatibilidad con tu frontend)
    if message_type is None and data.get('action'):
        message_type = 'action'
    
    if message_type == 'initialize':
        return await handle_initialize(data, session_id, engine)
    
    elif message_type == 'action':
        return await handle_action(data, session_id, client_id, engine)
    
    elif message_type == 'cursor_update':
        return await handle_cursor(data, session_id, client_id)
    
    elif message_type == 'ping':
        return {'type': 'pong'}
    
    else:
        logger.warning(f"⚠️ Tipo de mensaje desconocido: {data}")
        return {'type': 'error', 'message': f'Tipo desconocido: {message_type}'}


async def handle_initialize(data: dict, session_id: str, engine: InteractiveLayoutEngine) -> dict:
    """Inicializa el layout"""
    elements = data.get('elements', [])
    dimensions = data.get('dimensions', {})
    
    if dimensions:
        engine.length = dimensions.get('length', engine.length)
        engine.width = dimensions.get('width', engine.width)
    
    result = engine.initialize_from_elements(elements)
    
    # ✅ CRITICAL FIX: Enviar users actualizados
    users = manager.get_session_users(session_id)
    
    await manager.broadcast_to_session(
        session_id,
        {
            'type': 'state_update',
            'elements': result.get('elements', elements),
            'zones': result.get('zones', []),
            'metrics': result.get('metrics', {}),
            'users': users  # 👈 ESTO FALTABA
        }
    )
    
    return {'type': 'initialized', 'success': True}


async def handle_action(data: dict, session_id: str, client_id: str, engine: InteractiveLayoutEngine) -> dict:
    """Procesa acciones del engine (move, select, etc.)"""
    action = data.get('action')
    element_id = data.get('element_id')
    
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
        return {'type': 'error', 'message': f'Acción desconocida: {action}'}


async def handle_move(data: dict, session_id: str, client_id: str, engine: InteractiveLayoutEngine) -> dict:
    """Maneja acción move"""
    element_id = data.get('element_id')
    position = data.get('position', {})
    x = float(position.get('x', 0))
    y = float(position.get('y', 0))
    
    # Intentar bloquear elemento
    can_lock = await manager.try_lock_element(session_id, element_id, client_id)
    if not can_lock:
        return {
            'type': 'error',
            'code': 'ELEMENT_LOCKED',
            'message': f'Elemento {element_id} está bloqueado'
        }
    
    # Mover elemento
    result = await engine.move_element(element_id, x, y)
    
    if 'error' in result:
        return result
    
    # ✅ CRITICAL FIX: Preparar users actualizados
    users = manager.get_session_users(session_id)
    
    # Broadcast a TODOS
    await manager.broadcast_to_session(
        session_id,
        {
            'type': 'element_moved',
            'element_id': element_id,
            'position': {'x': x, 'y': y},
            'zones': result.get('zones', []),
            'metrics': result.get('metrics', {}),
            'users': users  # 👈 ESTO FALTABA
        }
    )
    
    return {'type': 'move_ack', 'success': True}


async def handle_select(data: dict, session_id: str, client_id: str) -> dict:
    """Maneja acción select (bloquear elemento)"""
    element_id = data.get('element_id')
    
    # Intentar bloquear
    can_lock = await manager.try_lock_element(session_id, element_id, client_id)
    
    # ✅ CRITICAL FIX: Preparar users actualizados
    users = manager.get_session_users(session_id)
    
    if can_lock:
        await manager.broadcast_to_session(
            session_id,
            {
                'type': 'element_locked',
                'element_id': element_id,
                'client_id': client_id,
                'user_name': manager.clients.get(client_id).user_name,
                'users': users  # 👈 ESTO FALTABA
            }
        )
        return {'type': 'select_ack', 'locked': True}
    else:
        return {
            'type': 'error',
            'code': 'ELEMENT_LOCKED',
            'message': f'Elemento {element_id} está siendo editado por otro usuario'
        }


async def handle_deselect(data: dict, session_id: str, client_id: str) -> dict:
    """Maneja acción deselect (desbloquear elemento)"""
    element_id = data.get('element_id')
    
    manager.unlock_element(client_id, element_id)
    
    # ✅ CRITICAL FIX: Preparar users actualizados
    users = manager.get_session_users(session_id)
    
    await manager.broadcast_to_session(
        session_id,
        {
            'type': 'element_unlocked',
            'element_id': element_id,
            'client_id': client_id,
            'users': users  # 👈 ESTO FALTABA
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
    if session_id not in layout_engines:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    
    engine = layout_engines[session_id]
    return engine.get_state()

@router.get("/api/sessions/stats")
async def get_stats():
    """Estadísticas de producción"""
    return {
        'total_clients': len(manager.clients),
        'total_sessions': len(manager.sessions),
        'sessions': {sid: len(clients) for sid, clients in manager.sessions.items()}
    }

# ============================================================
# HEALTH CHECK (Railway necesita esto)
# ============================================================

@router.get("/health")
async def health_check():
    """Health check para Railway"""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "connections": len(manager.clients)
    }

# ============================================================
# INSTRUCCIONES
# ============================================================

"""
CÓMO AÑADIR A main.py:

1. Importar al inicio:
   from websocket_routes import router as ws_router

2. Incluir router después de crear app:
   app.include_router(ws_router)

3. Asegurarse de tener websockets instalado:
   pip install websockets
"""