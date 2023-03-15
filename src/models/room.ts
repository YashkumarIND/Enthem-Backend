import mongoose from 'mongoose';
import { IRoom } from '../interfaces/IRoom';

const Room = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'title is required'],
      maxlength: 100,
      minlength: 3
    },    
    des: {
      type: String,
      required: false,
      default: "Welcome to the Room!",
      maxlength: 200,
      minlength: 3
    },
    ownerID: {
      type: String,
      required:[true, 'ownerID is required']
    },
    createdAt: {
      type: Date,
      required:false,
      default: Date.now
    },
    latitude: {
        type:Number,
        required: false,
        default: 100
    },
    longitude: {
        type:Number,
        required: false,
        default: 100
    },
    votes: {
        type:Number,
        required: false,
        default: 0
    },
  },
  { collection: 'rooms', timestamps: true }
);

export default mongoose.model<IRoom & mongoose.Document>('roomModel', Room);