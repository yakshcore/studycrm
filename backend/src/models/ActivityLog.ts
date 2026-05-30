import mongoose, { Schema, Document } from 'mongoose';

export interface IActivityLog extends Document {
  userId: mongoose.Types.ObjectId;
  action: string;
  target: string;
  targetId: mongoose.Types.ObjectId;
  details?: string;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>({
  userId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action:   { type: String, required: true },
  target:   { type: String, required: true },
  targetId: { type: Schema.Types.ObjectId, required: true },
  details:  String,
}, { timestamps: true });

export default mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);
