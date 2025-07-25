import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISession extends Document {
  courseId: Types.ObjectId;
  qrToken: string;
  date: Date;
  timeStart: string;
  timeEnd: string;
  type: 'entry' | 'exit';
}

const SessionSchema: Schema = new Schema({
  courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  qrToken: { type: String, required: true, unique: true },
  date: { type: Date, required: true },
  timeStart: { type: String, required: true },
  timeEnd: { type: String, required: true },
  type: { type: String, enum: ['entry', 'exit'], required: true },
});

export default mongoose.model<ISession>('Session', SessionSchema); 