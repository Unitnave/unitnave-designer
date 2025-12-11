"""
UNITNAVE Designer - WebSocket Manager (V1.1 PRODUCTION)
Thread-safe con soporte para Redis (comentado)
"""

import asyncio
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from datetime import datetime
from collections import defaultdict
from fastapi import WebSocket

logger = logging.getLogger(__name__)

@dataclass
class ClientInfo:
    client_id: str
    session_id: str
    websocket: WebSocket
    connected_at: datetime
    last_activity: datetime
    user_name: str = "Anónimo"
    cursor_position: Optional[Dict] = None
    selected_element: Optional[str] = None

class ConnectionManager:
    def __init__(self):
        self.clients: Dict[str, ClientInfo] = {}
        self.sessions: Dict[str, set] = defaultdict(set)
        self.lock_mutex = asyncio.Lock()
        logger.info("🔌 ConnectionManager inicializado")
    
    async def connect(self, websocket: WebSocket, session_id: str, 
                     client_id: str, user_name: str = "Anónimo") -> bool:
        try:
            await websocket.accept()
            self.clients[client_id] = ClientInfo(
                client_id=client_id,
                session_id=session_id,
                websocket=websocket,
                connected_at=datetime.now(),
                last_activity=datetime.now(),
                user_name=user_name
            )
            self.sessions[session_id].add(client_id)
            logger.info(f"✅ Cliente conectado: {client_id}")
            return True
        except Exception as e:
            logger.error(f"❌ Error conectando {client_id}: {e}")
            return False
    
    def disconnect(self, client_id: str):
        if client_id not in self.clients:
            return
        
        client = self.clients[client_id]
        self.sessions[client.session_id].discard(client_id)
        del self.clients[client_id]
        logger.info(f"🔌 Cliente desconectado: {client_id}")
    
    async def send_to_client(self, client_id: str, message: Dict) -> bool:
        if client_id not in self.clients:
            return False
        
        try:
            await self.clients[client_id].websocket.send_json(message)
            return True
        except:
            self.disconnect(client_id)
            return False
    
    async def broadcast_to_session(self, session_id: str, message: Dict,
                                  exclude: Optional[str] = None) -> int:
        if session_id not in self.sessions:
            return 0
        
        sent = 0
        for client_id in list(self.sessions[session_id]):
            if client_id == exclude:
                continue
            if await self.send_to_client(client_id, message):
                sent += 1
        
        return sent
    
    async def try_lock_element(self, session_id: str, element_id: str, 
                              client_id: str) -> bool:
        """Thread-safe lock con verificación real"""
        async with self.lock_mutex:
            # Verificar si otro cliente tiene el elemento bloqueado
            for cid in self.sessions.get(session_id, []):
                if cid != client_id:
                    client = self.clients.get(cid)
                    if client and client.selected_element == element_id:
                        logger.warning(f"⚠️ Elemento {element_id} ya bloqueado por {cid}")
                        return False
            
            # Bloquear elemento para este cliente
            if client_id in self.clients:
                self.clients[client_id].selected_element = element_id
                logger.info(f"🔒 Elemento {element_id} bloqueado por {client_id}")
                return True
            
            return False
    
    def unlock_element(self, client_id: str, element_id: str):
        """Desbloquear elemento"""
        client = self.clients.get(client_id)
        if client and client.selected_element == element_id:
            client.selected_element = None
            logger.info(f"🔓 Elemento {element_id} liberado por {client_id}")
    
    def update_cursor(self, client_id: str, x: float, y: float):
        """Actualizar posición de cursor"""
        if client_id in self.clients:
            self.clients[client_id].cursor_position = {'x': x, 'y': y}
    
    def get_session_users(self, session_id: str) -> List[dict]:
        """Obtener lista de usuarios con estado actualizado"""
        users = []
        for client_id in self.sessions.get(session_id, []):
            if client_id in self.clients:
                client = self.clients[client_id]
                users.append({
                    'client_id': client.client_id,
                    'user_name': client.user_name,
                    'selected_element': client.selected_element,
                    'cursor_position': client.cursor_position,
                    'connected_at': client.connected_at.isoformat()
                })
        return users

manager = ConnectionManager()