// server/models/Clip.js
const mongoose = require('mongoose');

const clipSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Clip title is required'],
    trim: true,
    maxlength: 150
  },
  description: {
    type: String,
    default: '',
    trim: true,
    maxlength: 500
  },
  startTime: {
    type: Number,
    required: true,
    min: 0
  },
  endTime: {
    type: Number,
    required: true,
    min: 0
  },
  duration: {
    type: Number,
    required: true,
    min: 1
  },
  score: {
    type: Number,
    default: 85,
    min: 1,
    max: 100
  },
  format: {
    type: String,
    enum: ['9:16', '16:9', '1:1'],
    default: '9:16'
  },
  captions: {
    type: Boolean,
    default: true
  },
  videoPath: {
    type: String,
    required: true
  },
  videoUrl: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String,
    default: ''
  },
  fileSize: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['generating', 'completed', 'failed'],
    default: 'generating'
  },
  errorMessage: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.model('Clip', clipSchema);
