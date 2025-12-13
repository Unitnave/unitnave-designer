"""
UNITNAVE Designer - WebSocket Manager (Backend) - FULL

Responsabilidades:
- Registro de clientes (client_id) por sesión (session_id)
- Broadcast seguro a una sesión (con exclude opcional)
- Locks por elemento: locks[session_id][element_id] = client_id
- Estado de usuarios online (cursor, selección)
- Limpieza de locks al desconectar
- Rate limiting (opcional) por cliente para evitar spam (move/cursor)
- Utilidades para integrar con websocket_routes.py

Notas de protocolo:
- snake_case en backend:
  client_id, session_id, user_name, element_id, cursor_position
- "type" en mensajes de servidor -> cliente (compat con tu frontend)
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from fastapi import WebSocket

logger = logging.getLogger(__name__)


# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now().isoformat()


def _json_dumps(obj: Any) -> str:
    # Asegura serialización robusta
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


async def _safe_send_text(ws: WebSocket, payload: str) -> bool:
    try:
        await ws.send_text(payload)
        return True
    except Exception:
        return False


# ------------------------------------------------------------
# Data structures
# ------------------------------------------------------------

@dataclass
class ClientInfo:
    websocket: WebSocket
    session_id: str
    client_id: str
    user_name: str
    connected_at: str = field(default_factory=_now_iso)

    # Estado colaborativo
    cursor_position: Optional[Dict[str, float]] = None
    selected_element: Optional[str] = None

    # Anti-spam / rate limiting (timestamps en segundos)
    last_move_at: float = 0.0
    last_cursor_at: float = 0.0


# ------------------------------------------------------------
# Manager
# ------------------------------------------------------------

class WebSocketManager:
    """
    Manager de clientes WebSocket multi-sesión.

    Estructuras:
      clients[client_id] = ClientInfo(...)
      sessions[session_id] = {client_id, ...}
      locks[session_id][element_id] = client_id

    Thread-safety:
      - mutaciones protegidas por self._lock (asyncio.Lock)
    """

    def __init__(
        self,
        *,
        move_min_interval_s: float = 0.03,     # ~33 msg/s max por cliente (move)
        cursor_min_interval_s: float = 0.02,   # ~50 msg/s max por cliente (cursor)
        drop_on_rate_limit: bool = True
    ):
        self.clients: Dict[str, ClientInfo] = {}
        self.sessions: Dict[str, Set[str]] = {}
        self.locks: Dict[str, Dict[str, str]] = {}

        self._lock = asyncio.Lock()

        # Rate limit
        self.move_min_interval_s = float(move_min_interval_s)
        self.cursor_min_interval_s = float(cursor_min_interval_s)
        self.drop_on_rate_limit = bool(drop_on_rate_limit)

    # ---------------------------
    # Connection lifecycle
    # ---------------------------

    async def connect(self, websocket: WebSocket, session_id: str, client_id: str, user_name: str) -> None:
        """
        Acepta WebSocket y registra cliente.
        """
        await websocket.accept()

        info = ClientInfo(
            websocket=websocket,
            session_id=session_id,
            client_id=client_id,
            user_name=user_name or "Usuario",
        )

        async with self._lock:
            self.clients[client_id] = info
            self.sessions.setdefault(session_id, set()).add(client_id)
            self.locks.setdefault(session_id, {})

        logger.info("WS connect client=%s session=%s user=%s", client_id, session_id, info.user_name)

    async def disconnect(
        self,
        client_id: str,
        *,
        on_session_empty: Optional[Callable[[str], None]] = None
    ) -> Tuple[str, List[str]]:
        """
        Desconecta un cliente.
        - libera locks del cliente
        - lo elimina de la sesión
        - si la sesión queda vacía, llama on_session_empty(session_id)

        Devuelve: (session_id, unlocked_element_ids)
        """
        async with self._lock:
            info = self.clients.get(client_id)
            if not info:
                return ("", [])

            session_id = info.session_id

            # 1) liberar locks del cliente
            unlocked: List[str] = []
            locks = self.locks.get(session_id, {})
            to_unlock = [el_id for el_id, locker in locks.items() if locker == client_id]
            for el_id in to_unlock:
                locks.pop(el_id, None)
                unlocked.append(el_id)

            # 2) limpiar selected_element
            if info.selected_element:
                info.selected_element = None

            # 3) quitar de sesión
            self.sessions.get(session_id, set()).discard(client_id)

            # 4) borrar cliente
            self.clients.pop(client_id, None)

            # 5) sesión vacía => cleanup
            session_empty = session_id in self.sessions and not self.sessions[session_id]
            if session_empty:
                self.sessions.pop(session_id, None)
                self.locks.pop(session_id, None)

                if on_session_empty:
                    try:
                        on_session_empty(session_id)
                    except Exception:
                        logger.exception("on_session_empty failed for session=%s", session_id)

        logger.info("WS disconnect client=%s session=%s unlocked=%s", client_id, session_id, len(unlocked))
        return (session_id, unlocked)

    # ---------------------------
    # Queries / state
    # ---------------------------

    def has_client(self, client_id: str) -> bool:
        return client_id in self.clients

    def get_client(self, client_id: str) -> Optional[ClientInfo]:
        return self.clients.get(client_id)

    def get_online_users(self, session_id: str) -> List[dict]:
        users: List[dict] = []
        for cid in self.sessions.get(session_id, set()):
            info = self.clients.get(cid)
            if not info:
                continue
            users.append({
                "client_id": info.client_id,
                "session_id": info.session_id,
                "user_name": info.user_name,
                "cursor_position": info.cursor_position,
                "selected_element": info.selected_element,
                "connected_at": info.connected_at,
            })
        return users

    def get_locked_elements(self, session_id: str) -> Dict[str, str]:
        return dict(self.locks.get(session_id, {}))

    def is_locked_by_other(self, session_id: str, element_id: str, client_id: str) -> bool:
        locker = self.locks.get(session_id, {}).get(element_id)
        return locker is not None and locker != client_id

    # ---------------------------
    # Broadcast / send
    # ---------------------------

    async def send_to_client(self, client_id: str, message: dict) -> bool:
        info = self.clients.get(client_id)
        if not info:
            return False
        payload = _json_dumps(message)
        return await _safe_send_text(info.websocket, payload)

    async def broadcast_to_session(self, session_id: str, message: dict, exclude: Optional[str] = None) -> None:
        """
        Envía el mensaje a todos los clientes de la sesión.
        exclude: client_id a excluir (ej: el emisor)
        """
        payload = _json_dumps(message)
        targets = list(self.sessions.get(session_id, set()))
        for cid in targets:
            if exclude and cid == exclude:
                continue
            info = self.clients.get(cid)
            if not info:
                continue
            ok = await _safe_send_text(info.websocket, payload)
            if not ok:
                # no lo desconectamos aquí (lo hará websocket_routes en close/disconnect)
                pass

    # ---------------------------
    # Locks
    # ---------------------------

    async def try_lock(self, session_id: str, element_id: str, client_id: str) -> bool:
        """
        Intenta bloquear un elemento para un cliente.
        Si ya está bloqueado por otro cliente -> False.
        Si está libre o por el mismo -> True.
        """
        async with self._lock:
            locks = self.locks.setdefault(session_id, {})
            if element_id in locks and locks[element_id] != client_id:
                return False
            locks[element_id] = client_id

            info = self.clients.get(client_id)
            if info:
                info.selected_element = element_id
            return True

    async def unlock(self, session_id: str, element_id: str, client_id: str) -> bool:
        """
        Desbloquea si el lock pertenece al cliente.
        """
        async with self._lock:
            locks = self.locks.get(session_id, {})
            if locks.get(element_id) != client_id:
                return False
            locks.pop(element_id, None)

            info = self.clients.get(client_id)
            if info and info.selected_element == element_id:
                info.selected_element = None

            return True

    async def release_all_locks_for_client(self, session_id: str, client_id: str) -> List[str]:
        """
        Libera todos los locks de un cliente (útil en desconexiones duras).
        """
        async with self._lock:
            locks = self.locks.get(session_id, {})
            to_unlock = [el_id for el_id, locker in locks.items() if locker == client_id]
            for el_id in to_unlock:
                locks.pop(el_id, None)

            info = self.clients.get(client_id)
            if info:
                info.selected_element = None

            return to_unlock

    # ---------------------------
    # Selection / cursor
    # ---------------------------

    async def set_selected_element(self, client_id: str, element_id: Optional[str]) -> None:
        async with self._lock:
            info = self.clients.get(client_id)
            if not info:
                return
            info.selected_element = element_id

    async def set_cursor(self, session_id: str, client_id: str, x: float, y: float) -> None:
        async with self._lock:
            info = self.clients.get(client_id)
            if not info or info.session_id != session_id:
                return
            info.cursor_position = {"x": float(x), "y": float(y)}

    # ---------------------------
    # Rate limiting (opcional)
    # ---------------------------

    def allow_move(self, client_id: str) -> bool:
        """
        Rate limit para eventos de move.
        Si drop_on_rate_limit=True, devuelve False si supera.
        """
        info = self.clients.get(client_id)
        if not info:
            return False

        now = time.time()
        if (now - info.last_move_at) < self.move_min_interval_s:
            return not self.drop_on_rate_limit  # si no drop, permitir
        info.last_move_at = now
        return True

    def allow_cursor(self, client_id: str) -> bool:
        """
        Rate limit para cursor.
        """
        info = self.clients.get(client_id)
        if not info:
            return False

        now = time.time()
        if (now - info.last_cursor_at) < self.cursor_min_interval_s:
            return not self.drop_on_rate_limit
        info.last_cursor_at = now
        return True
