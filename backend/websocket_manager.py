"""
UNITNAVE Designer - WebSocket Manager (Backend)
Gestor de conexiones WebSocket con heartbeat y broadcast

@version 2.0
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Set, Optional, Any
from dataclasses import dataclass, field
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


@dataclass
class ClientInfo:
    """Información de un cliente conectado"""
    websocket: WebSocket
    session_id: str
    client_id: str
    user_name: str
    connected_at: datetime = field(default_factory=datetime.now)
    cursor_position: Optional[Dict[str, float]] = None
    selected_element: Optional[str] = None
    last_ping: datetime = field(default_factory=datetime.now)


class WebSocketManager:
    """
    Gestor de conexiones WebSocket para colaboración en tiempo real.
    
    Características:
    - Múltiples sesiones independientes
    - Broadcast a todos los clientes de una sesión
    - Heartbeat para detectar desconexiones
    - Rate limiting por cliente
    """
    
    def __init__(self):
        # Clientes por sesión: {session_id: {client_id: ClientInfo}}
        self.sessions: Dict[str, Dict[str, ClientInfo]] = {}
        
        # Locks por sesión para operaciones thread-safe
        self.session_locks: Dict[str, asyncio.Lock] = {}
        
        # Elementos bloqueados: {session_id: {element_id: client_id}}
        self.locked_elements: Dict[str, Dict[str, str]] = {}
        
        # Rate limiting: {client_id: last_message_time}
        self.rate_limits: Dict[str, float] = {}
        self.rate_limit_interval = 0.033  # ~30 mensajes/segundo
        
        # Heartbeat
        self.heartbeat_interval = 30  # segundos
        self.heartbeat_timeout = 10  # segundos
        
        logger.info("WebSocketManager inicializado")
    
    def _get_session_lock(self, session_id: str) -> asyncio.Lock:
        """Obtener o crear lock para una sesión"""
        if session_id not in self.session_locks:
            self.session_locks[session_id] = asyncio.Lock()
        return self.session_locks[session_id]
    
    async def connect(
        self, 
        websocket: WebSocket, 
        session_id: str, 
        client_id: str, 
        user_name: str = "Anónimo"
    ) -> bool:
        """
        Conectar un cliente a una sesión.
        
        Args:
            websocket: Conexión WebSocket
            session_id: ID de la sesión
            client_id: ID único del cliente
            user_name: Nombre del usuario
            
        Returns:
            True si la conexión fue exitosa
        """
        try:
            await websocket.accept()
            
            async with self._get_session_lock(session_id):
                # Crear sesión si no existe
                if session_id not in self.sessions:
                    self.sessions[session_id] = {}
                    self.locked_elements[session_id] = {}
                    logger.info(f"Nueva sesión creada: {session_id}")
                
                # Registrar cliente
                client_info = ClientInfo(
                    websocket=websocket,
                    session_id=session_id,
                    client_id=client_id,
                    user_name=user_name
                )
                self.sessions[session_id][client_id] = client_info
                
                logger.info(f"Cliente conectado: {client_id} ({user_name}) en sesión {session_id}")
            
            # Notificar al cliente que está conectado
            await self.send_to_client(client_id, session_id, {
                "type": "connected",
                "session_id": session_id,
                "client_id": client_id,
                "user_name": user_name,
                "online_users": self._get_online_users(session_id),
                "locked_elements": self.locked_elements.get(session_id, {})
            })
            
            # Notificar a otros usuarios
            await self.broadcast_to_session(session_id, {
                "type": "user_joined",
                "client_id": client_id,
                "user": {
                    "client_id": client_id,
                    "user_name": user_name,
                    "connected_at": datetime.now().isoformat()
                },
                "online_users": self._get_online_users(session_id)
            }, exclude_client=client_id)
            
            # Iniciar heartbeat para este cliente
            asyncio.create_task(self._heartbeat_loop(session_id, client_id))
            
            return True
            
        except Exception as e:
            logger.error(f"Error conectando cliente {client_id}: {e}")
            return False
    
    async def disconnect(self, session_id: str, client_id: str):
        """Desconectar un cliente de una sesión"""
        async with self._get_session_lock(session_id):
            if session_id in self.sessions and client_id in self.sessions[session_id]:
                # Desbloquear elementos del cliente
                if session_id in self.locked_elements:
                    elements_to_unlock = [
                        el_id for el_id, locked_by in self.locked_elements[session_id].items()
                        if locked_by == client_id
                    ]
                    for el_id in elements_to_unlock:
                        del self.locked_elements[session_id][el_id]
                
                # Eliminar cliente
                del self.sessions[session_id][client_id]
                logger.info(f"Cliente desconectado: {client_id} de sesión {session_id}")
                
                # Limpiar sesión vacía
                if not self.sessions[session_id]:
                    del self.sessions[session_id]
                    if session_id in self.locked_elements:
                        del self.locked_elements[session_id]
                    if session_id in self.session_locks:
                        del self.session_locks[session_id]
                    logger.info(f"Sesión eliminada: {session_id}")
                else:
                    # Notificar a otros usuarios
                    await self.broadcast_to_session(session_id, {
                        "type": "user_left",
                        "client_id": client_id,
                        "online_users": self._get_online_users(session_id)
                    })
    
    async def send_to_client(
        self, 
        client_id: str, 
        session_id: str, 
        message: Dict[str, Any]
    ) -> bool:
        """Enviar mensaje a un cliente específico"""
        try:
            if session_id in self.sessions and client_id in self.sessions[session_id]:
                client = self.sessions[session_id][client_id]
                await client.websocket.send_json(message)
                return True
        except Exception as e:
            logger.error(f"Error enviando a cliente {client_id}: {e}")
        return False
    
    async def broadcast_to_session(
        self, 
        session_id: str, 
        message: Dict[str, Any],
        exclude_client: Optional[str] = None
    ):
        """Enviar mensaje a todos los clientes de una sesión"""
        if session_id not in self.sessions:
            return
        
        disconnected = []
        
        for client_id, client_info in self.sessions[session_id].items():
            if client_id == exclude_client:
                continue
            
            try:
                await client_info.websocket.send_json(message)
            except Exception as e:
                logger.warning(f"Error enviando a {client_id}: {e}")
                disconnected.append(client_id)
        
        # Limpiar clientes desconectados
        for client_id in disconnected:
            await self.disconnect(session_id, client_id)
    
    def _get_online_users(self, session_id: str) -> list:
        """Obtener lista de usuarios online en una sesión"""
        if session_id not in self.sessions:
            return []
        
        return [
            {
                "client_id": info.client_id,
                "user_name": info.user_name,
                "cursor_position": info.cursor_position,
                "selected_element": info.selected_element,
                "connected_at": info.connected_at.isoformat()
            }
            for info in self.sessions[session_id].values()
        ]
    
    async def update_cursor(
        self, 
        session_id: str, 
        client_id: str, 
        x: float, 
        y: float
    ):
        """Actualizar posición del cursor de un cliente"""
        if session_id in self.sessions and client_id in self.sessions[session_id]:
            self.sessions[session_id][client_id].cursor_position = {"x": x, "y": y}
            
            # Broadcast a otros usuarios
            await self.broadcast_to_session(session_id, {
                "type": "cursor_move",
                "client_id": client_id,
                "position": {"x": x, "y": y}
            }, exclude_client=client_id)
    
    async def update_selection(
        self, 
        session_id: str, 
        client_id: str, 
        element_id: Optional[str]
    ):
        """Actualizar selección de un cliente"""
        if session_id in self.sessions and client_id in self.sessions[session_id]:
            old_selection = self.sessions[session_id][client_id].selected_element
            self.sessions[session_id][client_id].selected_element = element_id
            
            await self.broadcast_to_session(session_id, {
                "type": "selection_change",
                "client_id": client_id,
                "old_element": old_selection,
                "new_element": element_id
            }, exclude_client=client_id)
    
    async def lock_element(
        self, 
        session_id: str, 
        client_id: str, 
        element_id: str
    ) -> bool:
        """Bloquear un elemento para edición exclusiva"""
        async with self._get_session_lock(session_id):
            if session_id not in self.locked_elements:
                self.locked_elements[session_id] = {}
            
            # Verificar si ya está bloqueado por otro
            if element_id in self.locked_elements[session_id]:
                locked_by = self.locked_elements[session_id][element_id]
                if locked_by != client_id:
                    return False
            
            # Bloquear
            self.locked_elements[session_id][element_id] = client_id
            
            await self.broadcast_to_session(session_id, {
                "type": "element_locked",
                "element_id": element_id,
                "client_id": client_id
            })
            
            return True
    
    async def unlock_element(
        self, 
        session_id: str, 
        client_id: str, 
        element_id: str
    ) -> bool:
        """Desbloquear un elemento"""
        async with self._get_session_lock(session_id):
            if session_id not in self.locked_elements:
                return True
            
            if element_id in self.locked_elements[session_id]:
                locked_by = self.locked_elements[session_id][element_id]
                
                # Solo el dueño puede desbloquear
                if locked_by != client_id:
                    return False
                
                del self.locked_elements[session_id][element_id]
                
                await self.broadcast_to_session(session_id, {
                    "type": "element_unlocked",
                    "element_id": element_id,
                    "client_id": client_id
                })
            
            return True
    
    def is_element_locked(
        self, 
        session_id: str, 
        element_id: str, 
        client_id: str
    ) -> bool:
        """Verificar si un elemento está bloqueado por otro usuario"""
        if session_id not in self.locked_elements:
            return False
        
        if element_id not in self.locked_elements[session_id]:
            return False
        
        return self.locked_elements[session_id][element_id] != client_id
    
    def check_rate_limit(self, client_id: str) -> bool:
        """Verificar rate limiting para un cliente"""
        import time
        now = time.time()
        
        if client_id in self.rate_limits:
            if now - self.rate_limits[client_id] < self.rate_limit_interval:
                return False
        
        self.rate_limits[client_id] = now
        return True
    
    async def _heartbeat_loop(self, session_id: str, client_id: str):
        """Loop de heartbeat para detectar desconexiones"""
        try:
            while True:
                await asyncio.sleep(self.heartbeat_interval)
                
                # Verificar si el cliente sigue conectado
                if session_id not in self.sessions:
                    break
                if client_id not in self.sessions[session_id]:
                    break
                
                # Enviar ping
                try:
                    await self.send_to_client(client_id, session_id, {"type": "ping"})
                except Exception:
                    logger.warning(f"Heartbeat fallido para {client_id}")
                    await self.disconnect(session_id, client_id)
                    break
                    
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error en heartbeat loop: {e}")
    
    async def handle_pong(self, session_id: str, client_id: str):
        """Manejar respuesta pong del cliente"""
        if session_id in self.sessions and client_id in self.sessions[session_id]:
            self.sessions[session_id][client_id].last_ping = datetime.now()
    
    def get_session_stats(self, session_id: str) -> Dict[str, Any]:
        """Obtener estadísticas de una sesión"""
        if session_id not in self.sessions:
            return {"exists": False}
        
        return {
            "exists": True,
            "client_count": len(self.sessions[session_id]),
            "clients": list(self.sessions[session_id].keys()),
            "locked_elements": len(self.locked_elements.get(session_id, {}))
        }
    
    def get_all_stats(self) -> Dict[str, Any]:
        """Obtener estadísticas globales"""
        return {
            "total_sessions": len(self.sessions),
            "total_clients": sum(len(clients) for clients in self.sessions.values()),
            "sessions": {
                sid: self.get_session_stats(sid) 
                for sid in self.sessions.keys()
            }
        }


# Instancia global
ws_manager = WebSocketManager()
