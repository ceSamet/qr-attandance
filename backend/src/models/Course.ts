import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICourse extends Document {
  name: string;
  instructorId: Types.ObjectId;
}

const CourseSchema: Schema = new Schema({
  name: { type: String, required: true },
  instructorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
});

export default mongoose.model<ICourse>('Course', CourseSchema); 