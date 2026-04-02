import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_conversation')
  handleJoinConversation(client: Socket, conversationId: number) {
    const room = `conversation:${conversationId}`;
    client.join(room);
    this.logger.log(`${client.id} joined ${room}`);
  }

  @SubscribeMessage('leave_conversation')
  handleLeaveConversation(client: Socket, conversationId: number) {
    const room = `conversation:${conversationId}`;
    client.leave(room);
    this.logger.log(`${client.id} left ${room}`);
  }

  @SubscribeMessage('join_inbox')
  handleJoinInbox(client: Socket, accountId: number) {
    const room = `account:${accountId}`;
    client.join(room);
    this.logger.log(`${client.id} joined ${room}`);
  }

  /** Broadcast new message to conversation room + globally */
  broadcastMessage(conversationId: number, message: Record<string, unknown>) {
    this.server
      .to(`conversation:${conversationId}`)
      .emit('new_message', message);
    // Also emit globally so messages are never missed (frontend filters by conversationId)
    this.server.emit('new_message', { ...message, conversationId });
  }

  /** Broadcast conversation update to account room + all connected clients */
  broadcastConversationUpdate(
    accountId: number,
    conversation: Record<string, unknown>,
  ) {
    // Emit to account room
    this.server
      .to(`account:${accountId}`)
      .emit('conversation_updated', conversation);
    // Also emit globally so all connected dashboards get the update
    this.server.emit('conversation_updated', conversation);
  }
}
