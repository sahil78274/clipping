// server/models/Project.js
const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  youtubeUrl: {
    type: String,
    trim: true,
    default: ''
  },
  title: {
    type: String,
    required: [true, 'Project title is required'],
    trim: true,
    maxlength: 200
  },
  status: {
    type: String,
    enum: ['Queued', 'Processing', 'Completed', 'Failed', 'waiting', 'analyzing', 'generating', 'completed', 'failed'],
    default: 'Queued',
    index: true
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  currentStep: {
    type: String,
    default: 'Queued in processing pipeline'
  },
  videoDuration: {
    type: Number,
    default: 0
  },
  minClipDuration: {
    type: Number,
    default: 60,
    min: 15,
    max: 600
  },
  maxClipDuration: {
    type: Number,
    default: 90,
    min: 15,
    max: 600
  },
  selectedDurationPreset: {
    type: String,
    default: '60-90s'
  },
  settings: {
    clipsCount: {
      type: Number,
      default: 5,
      min: 1,
      max: 20
    },
    minClipDuration: {
      type: Number,
      default: 60,
      min: 15,
      max: 600
    },
    maxClipDuration: {
      type: Number,
      default: 90,
      min: 15,
      max: 600
    },
    selectedDurationPreset: {
      type: String,
      default: '60-90s'
    },
    clipDuration: {
      type: Number,
      default: 75,
      min: 5,
      max: 600
    },
    clipDurationMode: {
      type: String,
      default: '60-90s'
    },
    qualityEnhancement: {
      type: String,
      enum: ['original', '1080p'],
      default: 'original'
    },
    format: {
      type: String,
      enum: ['9:16', '16:9', '1:1'],
      default: '9:16'
    },
    captions: {
      type: Boolean,
      default: true
    }
  },
  sourceType: {
    type: String,
    enum: ['upload', 'youtube'],
    default: 'upload'
  },
  sourcePath: {
    type: String,
    default: ''
  },
  sourceMetadata: {
    author: { type: String, default: '' },
    channel: { type: String, default: '' },
    resolution: { type: String, default: '' },
    fps: { type: Number, default: 30 },
    thumbnail: { type: String, default: '' }
  },
  creditsReserved: {
    type: Number,
    default: 0
  },
  creditsDeducted: {
    type: Number,
    default: 0
  },
  errorMessage: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

projectSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Project', projectSchema);
