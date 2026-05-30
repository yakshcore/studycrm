import mongoose, { Schema, Document } from 'mongoose';

export type MessageType = 'text' | 'file' | 'document_request' | 'system';

export interface IMessage extends Document {
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderName: string;
  type: MessageType;
  text?: string;
  fileUrl?: string;
  fileName?: string;
  readBy: mongoose.Types.ObjectId[];
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
  senderId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  senderName:     { type: String, required: true },
  type:           { type: String, enum: ['text','file','document_request','system'], default: 'text' },
  text:           String,
  fileUrl:        String,
  fileName:       String,
  readBy:         [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

export default mongoose.model<IMessage>('Message', MessageSchema);
