"""
UNITNAVE Designer - WebSocket Routes (V1.1)
Endpoints WebSocket para edición interactiva en tiempo real.

CHANGES:
- Fixed element_locked/element_unlocked messages to include users array
- Added proper user state broadcasting
- Added error handling for missing users in payload
"""

import uuid
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel

from websocket_manager import manager
from interactive_layout_engine import InteractiveLayoutEngine, layout_engines

logger = logging.getLogger(__name__)

# ============================================================
# STORAGE DE ENGINES (En producción usar Redis)
# ============================================================

layout_engines: Dict[str, InteractiveLayoutEngine] = {}
DEFAULT_LENGTH = 80
DEFAULT_WIDTH = 40

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
# WEBSOCKET PRINCIPAL
# ============================================================

@router.websocket("/ws/layout/{session_id}")
async def layout_websocket(websocket: WebSocket, session_id: str):
    """WebSocket principal para edición interactiva"""
    client_id = f"{session_id}_{uuid.uuid4().hex[:8]}"
    user_name = websocket.query_params.get('user', 'Anónimo')
    
    try:
        connected = await manager.connect(websocket, session_id, client_id, user_name)
        if not connected:
            return
        
        engine = get_or_create_engine(session_id)
        
        # Enviar estado inicial
        users = [
            {
                'client_id': u.client_id,
                'user_name': u.user_name,
                'selected_element': u.selected_element,
                'cursor_position': u.cursor_position,
                'connected_at': u.connected_at.isoformat()
            }
            for u in manager.clients.values() if u.session_id == session_id
        ]
        
        await websocket.send_json({
            'type': 'connected',
            'client_id': client_id,
            'session_id': session_id,
            'online_users': users,
            'locked_elements': {}
        })
        
        while True:
            data = await websocket.receive_json()
            
            async def engine_callback(action: str, params: Dict) -> Dict[str, Any]:
                return await process_engine_action(engine, session_id, client_id, action, params)
            
            response = await handle_websocket_message(
                websocket, client_id, session_id, data, engine_callback
            )
            
            if response:
                await websocket.send_json(response)
    
    except WebSocketDisconnect:
        logger.info(f"🔌 WebSocket desconectado: {client_id}")
    except Exception as e:
        logger.error(f"❌ Error en WebSocket {client_id}: {e}")
        try:
            await websocket.send_json({'type': 'error', 'code': 'INTERNAL_ERROR', 'message': str(e)})
        except:
            pass
    finally:
        manager.disconnect(client_id)
        
        # Notificar desconexión a otros usuarios
        users = [
            {
                'client_id': u.client_id,
                'user_name': u.user_name,
                'selected_element': u.selected_element,
                'cursor_position': u.cursor_position,
                'connected_at': u.connected_at.isoformat()
            }
            for u in manager.clients.values() if u.session_id == session_id
        ]
        
        await manager.broadcast_to_session(
            session_id,
            {
                'type': 'user_left',
                'client_id': client_id,
                'online_users': users
            }
        )


async def handle_websocket_message(
    websocket: WebSocket,
    client_id: str,
    session_id: str,
    data: Dict[str, Any],
    engine_callback: callable
) -> Optional[Dict[str, Any]]:
    """Manejador de mensajes WebSocket"""
    message_type = data.get('type')
    
    if message_type == 'initialize':
        elements = data.get('elements', [])
        dimensions = data.get('dimensions', {})
        engine = get_or_create_engine(session_id)
        if dimensions:
            engine.length = dimensions.get('length', engine.length)
            engine.width = dimensions.get('width', engine.width)
        
        result = engine.initialize_from_elements(elements)
        
        # Preparar lista de usuarios actualizada
        users = [
            {
                'client_id': u.client_id,
                'user_name': u.user_name,
                'selected_element': u.selected_element,
                'cursor_position': u.cursor_position,
                'connected_at': u.connected_at.isoformat()
            }
            for u in manager.clients.values() if u.session_id == session_id
        ]
        
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
    
    elif message_type == 'action':
        return await process_engine_action(
            get_or_create_engine(session_id),
            session_id,
            client_id,
            data.get('action'),
            data
        )
    
    elif message_type == 'cursor_update':
        x = data.get('x', 0)
        y = data.get('y', 0)
        manager.update_cursor(client_id, x, y)
        
        # Broadcast cursor position
        await manager.broadcast_to_session(
            session_id,
            {
                'type': 'cursor_move',
                'client_id': client_id,
                'user_name': manager.clients.get(client_id, {}).user_name,
                'position': {'x': x, 'y': y}
            },
            exclude=client_id
        )
        return None
    
    elif message_type == 'ping':
        return {'type': 'pong'}
    
    else:
        logger.warning(f"⚠️ Tipo de mensaje desconocido: {message_type}")
        return {'type': 'error', 'code': 'UNKNOWN_TYPE', 'message': f'Tipo desconocido: {message_type}'}


async def process_engine_action(engine: InteractiveLayoutEngine,
                                session_id: str,
                                client_id: str,
                                action: str,
                                params: Dict) -> Dict[str, Any]:
    """Procesa una acción del engine y broadcast resultados"""
    try:
        if action == 'move':
            element_id = params.get('element_id')
            position = params.get('position', {})
            x = float(position.get('x', 0))
            y = float(position.get('y', 0))
            
            # Intentar bloqueo
            can_lock = await manager.try_lock_element(session_id, element_id, client_id)
            if not can_lock:
                return {
                    'type': 'error',
                    'code': 'ELEMENT_LOCKED',
                    'message': f'Elemento {element_id} está siendo editado por otro usuario'
                }
            
            # Mover elemento
            result = await engine.move_element(element_id, x, y)
            
            if 'error' in result:
                return result
            
            # Preparar lista de usuarios actualizada
            users = [
                {
                    'client_id': u.client_id,
                    'user_name': u.user_name,
                    'selected_element': u.selected_element,
                    'cursor_position': u.cursor_position,
                    'connected_at': u.connected_at.isoformat()
                }
                for u in manager.clients.values() if u.session_id == session_id
            ]
            
            # Broadcast a todos
            await manager.broadcast_to_session(
                session_id,
                {
                    'type': 'element_moved',
                    'element_id': element_id,
                    'position': {'x': x, 'y': y},
                    'zones': result.get('zones', []),
                    'metrics': result.get('metrics', {}),
                    'online_users': users
                }
            )
            
            return {'type': 'move_ack', 'success': True}
        
        elif action == 'select':
            element_id = params.get('element_id')
            
            # Intentar bloqueo
            can_lock = await manager.try_lock_element(session_id, element_id, client_id)
            
            # Preparar lista de usuarios actualizada
            users = [
                {
                    'client_id': u.client_id,
                    'user_name': u.user_name,
                    'selected_element': u.selected_element,
                    'cursor_position': u.cursor_position,
                    'connected_at': u.connected_at.isoformat()
                }
                for u in manager.clients.values() if u.session_id == session_id
            ]
            
            if can_lock:
                await manager.broadcast_to_session(
                    session_id,
                    {
                        'type': 'element_locked',
                        'element_id': element_id,
                        'client_id': client_id,
                        'user_name': manager.clients.get(client_id).user_name,
                        'online_users': users
                    }
                )
                return {'type': 'select_ack', 'success': True, 'locked': True}
            else:
                return {
                    'type': 'error',
                    'code': 'ELEMENT_LOCKED',
                    'message': f'Elemento {element_id} está siendo editado por otro usuario'
                }
        
        elif action == 'deselect':
            element_id = params.get('element_id')
            manager.unlock_element(client_id, element_id)
            
            # Preparar lista de usuarios actualizada
            users = [
                {
                    'client_id': u.client_id,
                    'user_name': u.user_name,
                    'selected_element': u.selected_element,
                    'cursor_position': u.cursor_position,
                    'connected_at': u.connected_at.isoformat()
                }
                for u in manager.clients.values() if u.session_id == session_id
            ]
            
            await manager.broadcast_to_session(
                session_id,
                {
                    'type': 'element_unlocked',
                    'element_id': element_id,
                    'client_id': client_id,
                    'online_users': users
                }
            )
            return {'type': 'deselect_ack', 'success': True}
        
        elif action == 'get_state':
            result = engine.get_state()
            return {**result, 'type': 'state'}
        
        else:
            return {
                'type': 'error',
                'code': 'UNKNOWN_ACTION',
                'message': f'Acción desconocida: {action}'
            }
    
    except Exception as e:
        logger.error(f"❌ Error procesando {action}: {e}")
        return {
            'type': 'error',
            'code': 'ENGINE_ERROR',
            'message': str(e)
        }


# ============================================================
# REST ENDPOINTS (Fallback)
# ============================================================

class MoveRequest(BaseModel):
    element_id: str
    position: Dict[str, float]

@router.post("/api/layout/move/{session_id}")
async def move_element_rest(session_id: str, request: MoveRequest):
    """Mueve un elemento (REST fallback)"""
    if session_id not in layout_engines:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    
    engine = layout_engines[session_id]
    result = engine.move_element(request.element_id, request.position['x'], request.position['y'])
    
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    
    return result

@router.get("/api/sessions/stats")
async def get_session_stats():
    """Obtiene estadísticas de sesiones"""
    return {
        'total_clients': len(manager.clients),
        'total_sessions': len(manager.sessions),
        'sessions': {sid: len(clients) for sid, clients in manager.sessions.items()}
    }