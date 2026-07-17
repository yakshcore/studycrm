import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'super_admin' | 'admin' | 'counsellor_manager' | 'finance' | 'visa_team' | 'doc_verification' | 'university_team' | 'counsellor' | 'accountant' | 'support' | 'student' | 'university';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  studentId?: import('mongoose').Types.ObjectId;
  universityName?: string;   // set for role === 'university' — scopes their access
  isActive: boolean;
  lastSeenAt?: Date;         // updated when the user's last socket disconnects
  createdAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  role:           { type: String, enum: ['super_admin','admin','counsellor_manager','finance','visa_team','doc_verification','university_team','counsellor','accountant','support','student','university'], default: 'support' },
  avatar:         { type: String },
  phone:          { type: String },
  studentId:      { type: Schema.Types.ObjectId, ref: 'Student' },
  universityName: { type: String },   // required when role === 'university'
  isActive:   { type: Boolean, default: true },
  lastSeenAt: { type: Date },
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

UserSchema.set('toJSON', { transform: (_doc, ret) => { delete (ret as unknown as Record<string, unknown>).password; return ret; } });

export default mongoose.model<IUser>('User', UserSchema);
