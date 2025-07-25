import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAttendance extends Document {
  sessionId: Types.ObjectId;
  name: string;
  surname: string;
  timestamp: Date;
  ip: string;
}

const AttendanceSchema: Schema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  name: { type: String, required: true },
  surname: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  ip: { type: String, required: true },
});

export default mongoose.model<IAttendance>('Attendance', AttendanceSchema); 