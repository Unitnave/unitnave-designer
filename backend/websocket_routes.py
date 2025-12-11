"""
UNITNAVE Designer - WebSocket Routes (V1.0)

Endpoints WebSocket para edición interactiva en tiempo real.
AÑADIR ESTE ARCHIVO AL FINAL DE main.py O IMPORTARLO.

Endpoints:
- /ws/layout/{session_id} - WebSocket principal de edición
- /api/layout/move/{session_id} - REST fallback para move
- /api/layout/state/{session_id} - Obtener estado actual
- /api/sessions/stats - Estadísticas de conexiones

@version 1.0
"""

import uuid
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel

from websocket_manager import manager, handle_websocket_message
from interactive_layout_engine import InteractiveLayoutEngine

logger = logging.getLogger(__name__)

# ============================================================
# STORAGE DE ENGINES (En producción usar Redis)
# ============================================================

# Diccionario de engines por sesión
layout_engines: Dict[str, InteractiveLayoutEngine] = {}

# Configuración por defecto
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
    """
    WebSocket principal para edición interactiva.
    
    Protocolo de mensajes:
    
    Cliente → Servidor:
    {
        "action": "init|move|resize|rotate|add|delete|undo|redo|cursor|select|lock|unlock|ping",
        ...params específicos de cada acción
    }
    
    Servidor → Cliente:
    {
        "type": "zones_update|move_ack|error|user_joined|user_left|cursor_move|...",
        ...data
    }
    """
    # Generar ID único para este cliente
    client_id = f"{session_id}_{uuid.uuid4().hex[:8]}"
    
    # Extraer nombre de usuario del query string (opcional)
    user_name = websocket.query_params.get('user', 'Anónimo')
    
    # Conectar
    connected = await manager.connect(websocket, session_id, client_id, user_name)
    if not connected:
        return
    
    # Obtener o crear engine
    engine = get_or_create_engine(session_id)
    
    try:
        # Enviar estado inicial
        await websocket.send_json({
            'type': 'connected',
            'client_id': client_id,
            'session_id': session_id,
            'online_users': manager.get_session_users(session_id),
            'locked_elements': manager.get_locked_elements(session_id)
        })
        
        # Loop de mensajes
        while True:
            data = await websocket.receive_json()
            
            # Definir callback para engine operations
            async def engine_callback(action: str, params: Dict) -> Dict[str, Any]:
                return await process_engine_action(
                    engine, session_id, client_id, action, params
                )
            
            # Procesar mensaje
            response = await handle_websocket_message(
                websocket, client_id, session_id, data, engine_callback
            )
            
            # Enviar respuesta si hay
            if response:
                await websocket.send_json(response)
    
    except WebSocketDisconnect:
        logger.info(f"🔌 WebSocket desconectado: {client_id}")
    
    except Exception as e:
        logger.error(f"❌ Error en WebSocket {client_id}: {e}")
        try:
            await websocket.send_json({
                'type': 'error',
                'code': 'INTERNAL_ERROR',
                'message': str(e)
            })
        except:
            pass
    
    finally:
        manager.disconnect(client_id)


async def process_engine_action(engine: InteractiveLayoutEngine,
                                session_id: str,
                                client_id: str,
                                action: str,
                                params: Dict) -> Dict[str, Any]:
    """
    Procesa una acción del engine y broadcast resultados.
    """
    result = {}
    broadcast_data = None
    
    try:
        if action == 'init':
            # Inicializar con elementos
            elements = params.get('elements', [])
            dimensions = params.get('dimensions', {})
            
            if dimensions:
                engine.length = dimensions.get('length', engine.length)
                engine.width = dimensions.get('width', engine.width)
            
            result = engine.initialize_from_elements(elements)
            result['type'] = 'initialized'
            
            # Broadcast a otros
            broadcast_data = {
                'type': 'layout_reset',
                'zones': result.get('zones', []),
                'metrics': result.get('metrics', {}),
                'initiator': client_id
            }
        
        elif action == 'move':
            element_id = params.get('element_id')
            position = params.get('position', {})
            x = float(position.get('x', 0))
            y = float(position.get('y', 0))
            
            result = engine.move_element(element_id, x, y)
            
            if 'error' not in result:
                result['type'] = 'move_ack'
                
                # Broadcast a otros
                broadcast_data = {
                    'type': 'element_moved',
                    'element_id': element_id,
                    'position': {'x': x, 'y': y},
                    'zones': result.get('zones', []),
                    'metrics': result.get('metrics', {}),
                    'by_client': client_id,
                    'by_user': manager.clients.get(client_id, {}).user_name if client_id in manager.clients else 'Unknown'
                }
            else:
                result['type'] = 'error'
        
        elif action == 'resize':
            element_id = params.get('element_id')
            dimensions = params.get('dimensions', {})
            width = float(dimensions.get('width', 1))
            height = float(dimensions.get('height', 1))
            anchor = params.get('anchor', 'center')
            
            result = engine.resize_element(element_id, width, height, anchor)
            
            if 'error' not in result:
                result['type'] = 'resize_ack'
                
                broadcast_data = {
                    'type': 'element_resized',
                    'element_id': element_id,
                    'dimensions': dimensions,
                    'zones': result.get('zones', []),
                    'by_client': client_id
                }
            else:
                result['type'] = 'error'
        
        elif action == 'rotate':
            element_id = params.get('element_id')
            rotation = float(params.get('rotation', 0))
            
            result = engine.rotate_element(element_id, rotation)
            
            if 'error' not in result:
                result['type'] = 'rotate_ack'
                
                broadcast_data = {
                    'type': 'element_rotated',
                    'element_id': element_id,
                    'rotation': rotation,
                    'zones': result.get('zones', []),
                    'by_client': client_id
                }
            else:
                result['type'] = 'error'
        
        elif action == 'add':
            element = params.get('element', {})
            
            result = engine.add_element(element)
            
            if 'error' not in result:
                result['type'] = 'add_ack'
                
                broadcast_data = {
                    'type': 'element_added',
                    'element': result.get('operation', {}).get('element'),
                    'zones': result.get('zones', []),
                    'by_client': client_id
                }
            else:
                result['type'] = 'error'
        
        elif action == 'delete':
            element_id = params.get('element_id')
            
            result = engine.delete_element(element_id)
            
            if 'error' not in result:
                result['type'] = 'delete_ack'
                
                broadcast_data = {
                    'type': 'element_deleted',
                    'element_id': element_id,
                    'zones': result.get('zones', []),
                    'by_client': client_id
                }
            else:
                result['type'] = 'error'
        
        elif action == 'undo':
            result = engine.undo()
            
            if 'error' not in result:
                result['type'] = 'undo_ack'
                
                broadcast_data = {
                    'type': 'undo_applied',
                    'undone': result.get('undone'),
                    'zones': result.get('zones', []),
                    'by_client': client_id
                }
            else:
                result['type'] = 'error'
        
        elif action == 'redo':
            result = engine.redo()
            
            if 'error' not in result:
                result['type'] = 'redo_ack'
                
                broadcast_data = {
                    'type': 'redo_applied',
                    'redone': result.get('redone'),
                    'zones': result.get('zones', []),
                    'by_client': client_id
                }
            else:
                result['type'] = 'error'
        
        elif action == 'get_state':
            result = engine.get_state()
            result['type'] = 'state'
        
        elif action == 'check_collision':
            element_id = params.get('element_id')
            x = float(params.get('x', 0))
            y = float(params.get('y', 0))
            
            result = engine.check_collision_realtime(element_id, x, y)
            result['type'] = 'collision_check'
        
        else:
            result = {
                'type': 'error',
                'code': 'UNKNOWN_ACTION',
                'message': f'Acción desconocida: {action}'
            }
        
        # Broadcast si hay data
        if broadcast_data:
            await manager.broadcast_to_session(
                session_id, broadcast_data, exclude=client_id
            )
        
        # Añadir timestamp
        result['timestamp'] = datetime.now().isoformat()
        
        return result
    
    except Exception as e:
        logger.error(f"❌ Error procesando {action}: {e}")
        return {
            'type': 'error',
            'code': 'ENGINE_ERROR',
            'message': str(e),
            'action': action
        }


# ============================================================
# REST ENDPOINTS (Fallback)
# ============================================================

class MoveRequest(BaseModel):
    element_id: str
    position: Dict[str, float]

class ResizeRequest(BaseModel):
    element_id: str
    dimensions: Dict[str, float]
    anchor: str = 'center'

class AddElementRequest(BaseModel):
    element: Dict[str, Any]

class InitRequest(BaseModel):
    dimensions: Optional[Dict[str, float]] = None
    elements: list = []


@router.post("/api/layout/init/{session_id}")
async def init_layout(session_id: str, request: InitRequest):
    """Inicializa un layout con elementos (REST fallback)"""
    engine = get_or_create_engine(
        session_id,
        request.dimensions.get('length', DEFAULT_LENGTH) if request.dimensions else DEFAULT_LENGTH,
        request.dimensions.get('width', DEFAULT_WIDTH) if request.dimensions else DEFAULT_WIDTH
    )
    
    result = engine.initialize_from_elements(request.elements)
    return result


@router.post("/api/layout/move/{session_id}")
async def move_element_rest(session_id: str, request: MoveRequest):
    """Mueve un elemento (REST fallback)"""
    if session_id not in layout_engines:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    
    engine = layout_engines[session_id]
    result = engine.move_element(
        request.element_id,
        request.position.get('x', 0),
        request.position.get('y', 0)
    )
    
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    
    return result


@router.post("/api/layout/resize/{session_id}")
async def resize_element_rest(session_id: str, request: ResizeRequest):
    """Redimensiona un elemento (REST fallback)"""
    if session_id not in layout_engines:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    
    engine = layout_engines[session_id]
    result = engine.resize_element(
        request.element_id,
        request.dimensions.get('width', 1),
        request.dimensions.get('height', 1),
        request.anchor
    )
    
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    
    return result


@router.post("/api/layout/add/{session_id}")
async def add_element_rest(session_id: str, request: AddElementRequest):
    """Añade un elemento (REST fallback)"""
    engine = get_or_create_engine(session_id)
    result = engine.add_element(request.element)
    
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    
    return result


@router.delete("/api/layout/element/{session_id}/{element_id}")
async def delete_element_rest(session_id: str, element_id: str):
    """Elimina un elemento (REST fallback)"""
    if session_id not in layout_engines:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    
    engine = layout_engines[session_id]
    result = engine.delete_element(element_id)
    
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    
    return result


@router.get("/api/layout/state/{session_id}")
async def get_layout_state(session_id: str):
    """Obtiene el estado actual de un layout"""
    if session_id not in layout_engines:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    
    engine = layout_engines[session_id]
    return engine.get_state()


@router.post("/api/layout/undo/{session_id}")
async def undo_rest(session_id: str):
    """Deshace la última operación (REST fallback)"""
    if session_id not in layout_engines:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    
    engine = layout_engines[session_id]
    result = engine.undo()
    
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    
    return result


@router.post("/api/layout/redo/{session_id}")
async def redo_rest(session_id: str):
    """Rehace la última operación deshecha (REST fallback)"""
    if session_id not in layout_engines:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    
    engine = layout_engines[session_id]
    result = engine.redo()
    
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    
    return result


@router.post("/api/layout/collision/{session_id}")
async def check_collision_rest(session_id: str, element_id: str, x: float, y: float):
    """Verifica colisiones (REST fallback)"""
    if session_id not in layout_engines:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    
    engine = layout_engines[session_id]
    return engine.check_collision_realtime(element_id, x, y)


# ============================================================
# ADMIN ENDPOINTS
# ============================================================

@router.get("/api/sessions/stats")
async def get_session_stats():
    """Obtiene estadísticas de sesiones y conexiones"""
    return {
        'connection_stats': manager.get_stats(),
        'engine_count': len(layout_engines),
        'engines': {
            sid: {
                'length': e.length,
                'width': e.width,
                'element_count': len(e.elements),
                'history_size': len(e.operation_history)
            }
            for sid, e in layout_engines.items()
        }
    }


@router.delete("/api/sessions/{session_id}")
async def cleanup_session(session_id: str):
    """Limpia una sesión y sus recursos"""
    cleaned = []
    
    if session_id in layout_engines:
        del layout_engines[session_id]
        cleaned.append('engine')
    
    if session_id in manager.sessions:
        # Desconectar todos los clientes de la sesión
        for client_id in list(manager.sessions[session_id].clients):
            manager.disconnect(client_id)
        cleaned.append('session')
    
    return {
        'session_id': session_id,
        'cleaned': cleaned,
        'status': 'ok' if cleaned else 'not_found'
    }


# ============================================================
# INSTRUCCIONES DE USO
# ============================================================

"""
CÓMO AÑADIR A main.py:

1. Importar al inicio:
   from websocket_routes import router as ws_router

2. Incluir router después de crear app:
   app.include_router(ws_router)

3. Asegurarse de tener websockets instalado:
   pip install websockets

EJEMPLO DE CONEXIÓN FRONTEND:

const ws = new WebSocket('ws://localhost:8000/ws/layout/mi-sesion-123?user=Pablo');

ws.onopen = () => {
    // Inicializar con elementos
    ws.send(JSON.stringify({
        action: 'init',
        elements: [...],
        dimensions: { length: 80, width: 40 }
    }));
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Recibido:', data.type);
};

// Mover elemento
ws.send(JSON.stringify({
    action: 'move',
    element_id: 'shelf-1',
    position: { x: 10, y: 5 }
}));
"""
