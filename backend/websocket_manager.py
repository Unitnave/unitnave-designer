"""
UNITNAVE Designer - WebSocket Manager (V1.0)
Gestor de conexiones simplificado con heartbeat - EN MEMORIA

Características:
- Heartbeat cada 30s para detectar desconexiones
- asyncio.Lock para thread-safety
- Rate limiting básico (30 msg/seg)
- Locking de elementos usando selected_element
"""

import asyncio
import logging
import time
from typing import Dict, List, Set, Optional, Any
from dataclasses import dataclass
from datetime import datetime
from collections import defaultdict
from fastapi import WebSocket

logger = logging.getLogger(__name__)


# ============================================================
# DATA CLASSES
# ============================================================

@dataclass
class ClientInfo:
    """Información de un cliente conectado"""
    client_id: str
    session_id: str
    websocket: WebSocket
    connected_at: datetime
    last_activity: datetime
    user_name: str = "Anónimo"
    cursor_position: Optional[Dict] = None
    selected_element: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return {
            'client_id': self.client_id,
            'session_id': self.session_id,
            'user_name': self.user_name,
            'cursor_position': self.cursor_position,
            'selected_element': self.selected_element,
            'connected_at': self.connected_at.isoformat()
        }


# ============================================================
# CONNECTION MANAGER
# ============================================================

class ConnectionManager:
    """Gestor simplificado con heartbeat básico - TODO EN MEMORIA"""
    
    def __init__(self):
        # Clientes: client_id -> ClientInfo
        self.clients: Dict[str, ClientInfo] = {}
        
        # Sesiones: session_id -> Set[client_id]
        self.sessions: Dict[str, Set[str]] = defaultdict(set)
        
        # WebSocket -> client_id (lookup inverso)
        self.ws_to_client: Dict[WebSocket, str] = {}
        
        # Lock para operaciones thread-safe
        self.lock_mutex = asyncio.Lock()
        
        # Rate limiting: client_id -> [timestamps]
        self.rate_limits: Dict[str, List[float]] = defaultdict(list)
        
        # Heartbeat tasks
        self.heartbeat_tasks: Dict[str, asyncio.Task] = {}
        
        logger.info("🔌 ConnectionManager inicializado")
    
    # ============================================================
    # CONEXIÓN / DESCONEXIÓN
    # ============================================================
    
    async def connect(self, websocket: WebSocket, session_id: str, 
                     client_id: str, user_name: str = "Anónimo") -> bool:
        """Conecta un nuevo cliente"""
        try:
            await websocket.accept()
            
            now = datetime.now()
            
            # Crear info del cliente
            self.clients[client_id] = ClientInfo(
                client_id=client_id,
                session_id=session_id,
                websocket=websocket,
                connected_at=now,
                last_activity=now,
                user_name=user_name
            )
            
            # Registrar en sesión
            self.sessions[session_id].add(client_id)
            self.ws_to_client[websocket] = client_id
            
            # Iniciar heartbeat
            self.heartbeat_tasks[client_id] = asyncio.create_task(
                self._heartbeat_loop(client_id)
            )
            
            logger.info(f"✅ Cliente conectado: {client_id} → sesión {session_id}")
            
            # Notificar a otros de la sesión
            await self.broadcast_to_session(
                session_id,
                {
                    'type': 'user_joined',
                    'user': self.clients[client_id].to_dict(),
                    'online_users': self.get_session_users(session_id)
                },
                exclude=client_id
            )
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error conectando {client_id}: {e}")
            return False
    
    async def _heartbeat_loop(self, client_id: str):
        """Envía ping cada 30s para detectar desconexiones"""
        while client_id in self.clients:
            try:
                await asyncio.sleep(30)
                if client_id in self.clients:
                    success = await self.send_to_client(client_id, {'type': 'ping'})
                    if not success:
                        break
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"⚠️ Heartbeat error para {client_id}: {e}")
                break
    
    def disconnect(self, client_id: str):
        """Desconecta un cliente"""
        if client_id not in self.clients:
            return
        
        client = self.clients[client_id]
        session_id = client.session_id
        
        # Cancelar heartbeat
        if client_id in self.heartbeat_tasks:
            self.heartbeat_tasks[client_id].cancel()
            del self.heartbeat_tasks[client_id]
        
        # Limpiar websocket mapping
        if client.websocket in self.ws_to_client:
            del self.ws_to_client[client.websocket]
        
        # Eliminar cliente
        del self.clients[client_id]
        
        # Actualizar sesión
        self.sessions[session_id].discard(client_id)
        if not self.sessions[session_id]:
            del self.sessions[session_id]
        
        logger.info(f"🔌 Cliente desconectado: {client_id}")
        
        # Notificar a otros (en background)
        asyncio.create_task(
            self.broadcast_to_session(
                session_id,
                {
                    'type': 'user_left',
                    'client_id': client_id,
                    'online_users': self.get_session_users(session_id)
                }
            )
        )
    
    def disconnect_by_websocket(self, websocket: WebSocket):
        """Desconecta usando WebSocket como referencia"""
        client_id = self.ws_to_client.get(websocket)
        if client_id:
            self.disconnect(client_id)
    
    # ============================================================
    # MENSAJERÍA
    # ============================================================
    
    async def send_to_client(self, client_id: str, message: Dict) -> bool:
        """Envía mensaje a un cliente específico"""
        if client_id not in self.clients:
            return False
        
        try:
            client = self.clients[client_id]
            await client.websocket.send_json(message)
            client.last_activity = datetime.now()
            return True
        except Exception as e:
            logger.warning(f"⚠️ Error enviando a {client_id}: {e}")
            self.disconnect(client_id)
            return False
    
    async def broadcast_to_session(self, session_id: str, message: Dict,
                                  exclude: Optional[str] = None) -> int:
        """Broadcast a todos los clientes de una sesión"""
        if session_id not in self.sessions:
            return 0
        
        sent = 0
        disconnected = []
        
        for client_id in list(self.sessions[session_id]):
            if client_id == exclude:
                continue
            
            if await self.send_to_client(client_id, message):
                sent += 1
            else:
                disconnected.append(client_id)
        
        # Limpiar desconectados
        for cid in disconnected:
            self.disconnect(cid)
        
        return sent
    
    # ============================================================
    # LOCKING DE ELEMENTOS
    # ============================================================
    
    async def try_lock_element(self, session_id: str, element_id: str, 
                              client_id: str) -> bool:
        """Intenta bloquear un elemento - thread-safe"""
        async with self.lock_mutex:
            # Verificar si otro lo tiene bloqueado
            for cid in self.sessions.get(session_id, []):
                if cid != client_id:
                    client = self.clients.get(cid)
                    if client and client.selected_element == element_id:
                        return False
            
            # Bloquear
            if client_id in self.clients:
                self.clients[client_id].selected_element = element_id
                return True
            
            return False
    
    def unlock_element(self, client_id: str, element_id: str):
        """Desbloquea un elemento"""
        client = self.clients.get(client_id)
        if client and client.selected_element == element_id:
            client.selected_element = None
    
    def is_element_locked(self, session_id: str, element_id: str, client_id: str) -> bool:
        """Verifica si un elemento está bloqueado por otro"""
        for cid in self.sessions.get(session_id, []):
            if cid != client_id:
                client = self.clients.get(cid)
                if client and client.selected_element == element_id:
                    return True
        return False
    
    # ============================================================
    # CURSOR Y SELECCIÓN
    # ============================================================
    
    def update_cursor(self, client_id: str, x: float, y: float):
        """Actualiza posición del cursor"""
        if client_id in self.clients:
            self.clients[client_id].cursor_position = {'x': x, 'y': y}
            self.clients[client_id].last_activity = datetime.now()
    
    async def broadcast_cursor(self, client_id: str, x: float, y: float):
        """Actualiza y broadcast cursor a otros"""
        if client_id not in self.clients:
            return
        
        self.update_cursor(client_id, x, y)
        client = self.clients[client_id]
        
        await self.broadcast_to_session(
            client.session_id,
            {
                'type': 'cursor_move',
                'client_id': client_id,
                'user_name': client.user_name,
                'position': {'x': x, 'y': y}
            },
            exclude=client_id
        )
    
    async def update_selection(self, client_id: str, element_id: Optional[str]):
        """Actualiza selección y broadcast"""
        if client_id not in self.clients:
            return
        
        client = self.clients[client_id]
        old_selection = client.selected_element
        client.selected_element = element_id
        
        await self.broadcast_to_session(
            client.session_id,
            {
                'type': 'selection_change',
                'client_id': client_id,
                'user_name': client.user_name,
                'old_element': old_selection,
                'new_element': element_id
            },
            exclude=client_id
        )
    
    # ============================================================
    # RATE LIMITING
    # ============================================================
    
    def check_rate_limit(self, client_id: str) -> bool:
        """Verifica rate limit (30 msg/seg)"""
        now = time.time()
        timestamps = self.rate_limits[client_id]
        
        # Limpiar timestamps antiguos (ventana de 1 segundo)
        timestamps[:] = [t for t in timestamps if now - t < 1.0]
        
        if len(timestamps) >= 30:
            logger.warning(f"⚠️ Rate limit excedido: {client_id}")
            return False
        
        timestamps.append(now)
        return True
    
    # ============================================================
    # UTILIDADES
    # ============================================================
    
    def get_session_users(self, session_id: str) -> List[Dict]:
        """Obtiene lista de usuarios en una sesión"""
        users = []
        for client_id in self.sessions.get(session_id, []):
            if client_id in self.clients:
                users.append(self.clients[client_id].to_dict())
        return users
    
    def get_client_info(self, client_id: str) -> Optional[Dict]:
        """Obtiene información de un cliente"""
        if client_id in self.clients:
            return self.clients[client_id].to_dict()
        return None
    
    def get_stats(self) -> Dict[str, Any]:
        """Obtiene estadísticas"""
        return {
            'total_clients': len(self.clients),
            'total_sessions': len(self.sessions),
            'sessions': {
                sid: len(clients) for sid, clients in self.sessions.items()
            }
        }


# ============================================================
# INSTANCIA GLOBAL
# ============================================================

manager = ConnectionManager()
