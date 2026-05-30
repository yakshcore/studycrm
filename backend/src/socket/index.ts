import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { setIo } from './emitter';

export function setupSocket(io: Server) {
  // Register io so routes can emit events without circular imports
  setIo(io);

  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Auto-join user's personal notification room so we can push notifications in real-time
    const token = socket.handshake.auth?.token as string | undefined;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { id: string };
        socket.join(`user:${decoded.id}`);
      } catch { /* invalid / expired token — no personal room */ }
    }

    socket.on('join_room', (roomId: string) => {
      socket.join(roomId);
    });

    socket.on('leave_room', (roomId: string) => {
      socket.leave(roomId);
    });

    // Legacy socket-based send (emits to other room members)
    socket.on('send_message', (data: { conversationId: string; message: unknown }) => {
      socket.to(data.conversationId).emit('receive_message', data.message);
    });

    socket.on('typing', (data: { roomId?: string; conversationId?: string; userId?: string; isTyping: boolean }) => {
      const roomId = data.roomId ?? data.conversationId;
      if (roomId) socket.to(roomId).emit('typing', { ...data, userId: data.userId ?? socket.id });
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}
