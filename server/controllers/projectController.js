// server/controllers/projectController.js
const path = require('path');
const fs = require('fs');
const Project = require('../models/Project');
const Clip = require('../models/Clip');
const { analyzeVideoMoments } = require('../services/gemini');
const {
  getVideoMetadata,
  getOrCreateSampleVideo,
  renderClip,
  outputsDir,
} = require('../services/videoProcessor');
const {
  calculateCost,
  reserveCredits,
  finalizeCredits,
  refundCredits,
} = require('../services/creditService');

// Helper to validate and extract YouTube Video ID
function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i);
  return match ? match[1] : null;
}

// Background Worker to process project clips
async function processProjectAsync(projectId) {
  let project = await Project.findById(projectId);
  if (!project) return;

  const userId = project.userId;
  const creditsToDeduct = project.creditsReserved;

  try {
    // Step 1: Prepare authorized source video
    project.status = 'analyzing';
    project.currentStep = 'Verifying authorized video source';
    project.progress = 10;
    await project.save();

    let sourcePath = project.sourcePath;
    let duration = project.videoDuration || 60;

    if (!sourcePath || !fs.existsSync(sourcePath)) {
      // Use authorized creator sample video
      const sample = await getOrCreateSampleVideo();
      sourcePath = sample.path;
      duration = sample.duration;
      project.sourcePath = sourcePath;
      project.videoDuration = duration;
      project.sourceType = 'sample';
      await project.save();
    } else {
      const meta = await getVideoMetadata(sourcePath);
      duration = meta.duration || 60;
      project.videoDuration = duration;
      await project.save();
    }

    // Step 2: Send to Gemini for intelligent moment detection
    project.currentStep = 'Analyzing video with Gemini AI for best moments';
    project.progress = 25;
    await project.save();

    const clipsCount = project.settings.clipsCount || 5;
    const detectedMoments = await analyzeVideoMoments({
      title: project.title,
      description: project.youtubeUrl ? `YouTube Video URL: ${project.youtubeUrl}` : 'Creator video upload',
      duration,
      clipsCount,
    });

    if (!detectedMoments || detectedMoments.length === 0) {
      throw new Error('No valid clip moments could be identified from this video.');
    }

    // Step 3: Render clips using FFmpeg
    project.status = 'generating';
    project.currentStep = `Rendering ${detectedMoments.length} clips with FFmpeg`;
    project.progress = 40;
    await project.save();

    const createdClips = [];
    const totalClips = detectedMoments.length;

    for (let i = 0; i < totalClips; i++) {
      const moment = detectedMoments[i];
      const clipIndex = i + 1;

      project.currentStep = `Rendering clip ${clipIndex} of ${totalClips}: "${moment.title}"`;
      project.progress = Math.min(95, Math.floor(40 + (i / totalClips) * 55));
      await project.save();

      const clipFileName = `clip_${project._id}_${clipIndex}_${Date.now()}.mp4`;
      const thumbFileName = `thumb_${project._id}_${clipIndex}_${Date.now()}.jpg`;

      const outputPath = path.join(outputsDir, clipFileName);
      const thumbnailPath = path.join(outputsDir, thumbFileName);

      const renderRes = await renderClip({
        inputPath: sourcePath,
        outputPath,
        thumbnailPath,
        startTime: moment.startTime,
        endTime: moment.endTime,
        format: project.settings.format || '9:16',
        captions: project.settings.captions !== false,
        title: moment.title,
      });

      const clip = await Clip.create({
        userId: project.userId,
        projectId: project._id,
        title: moment.title,
        description: moment.description,
        startTime: moment.startTime,
        endTime: moment.endTime,
        duration: renderRes.duration,
        score: moment.score || 85,
        format: project.settings.format || '9:16',
        captions: project.settings.captions !== false,
        videoPath: outputPath,
        videoUrl: `/outputs/${clipFileName}`,
        thumbnailUrl: `/outputs/${thumbFileName}`,
        fileSize: renderRes.fileSize || 0,
        status: 'completed',
      });

      createdClips.push(clip);
    }

    // Step 4: Finalize project & permanently deduct credits
    project.status = 'completed';
    project.progress = 100;
    project.currentStep = 'All clips generated successfully';
    project.creditsDeducted = creditsToDeduct;
    await project.save();

    await finalizeCredits(userId, creditsToDeduct, project._id, createdClips.length);
    console.log(`[Project ${projectId}] Completed successfully with ${createdClips.length} clips.`);
  } catch (err) {
    console.error(`[Project ${projectId}] Processing failed:`, err);

    project.status = 'failed';
    project.currentStep = 'Generation failed';
    project.errorMessage = err.message || 'An error occurred during video clipping.';
    await project.save();

    // Refund reserved credits
    if (creditsToDeduct > 0) {
      await refundCredits(userId, creditsToDeduct, project._id, `Processing failed: ${err.message}`);
    }
  }
}

// POST /api/projects - Create and start new clipping project
const createProject = async (req, res) => {
  try {
    const { youtubeUrl, title, clipsCount = 5, format = '9:16', captions = true, useSample = false } = req.body;
    const uploadedFile = req.file;

    const parsedClipsCount = Math.min(20, Math.max(1, parseInt(clipsCount, 10) || 5));
    const validFormats = ['9:16', '16:9', '1:1'];
    const chosenFormat = validFormats.includes(format) ? format : '9:16';
    const isCaptions = captions === 'true' || captions === true || captions === 'on';

    // Credit calculation & check
    const requiredCredits = calculateCost(parsedClipsCount);
    if (req.user.credits < requiredCredits) {
      return res.status(400).json({
        success: false,
        message: `Insufficient credits. This project requires ${requiredCredits} credits, but you have ${req.user.credits} credits.`,
        requiredCredits,
        availableCredits: req.user.credits,
      });
    }

    let sourceType = 'youtube';
    let sourcePath = '';
    let projectTitle = (title || '').trim();
    let videoDuration = 60;

    // Determine source
    if (uploadedFile) {
      sourceType = 'upload';
      sourcePath = uploadedFile.path;
      if (!projectTitle) {
        projectTitle = path.parse(uploadedFile.originalname).name;
      }
      try {
        const meta = await getVideoMetadata(sourcePath);
        videoDuration = meta.duration;
      } catch (metaErr) {
        console.warn('Metadata probe warning for upload:', metaErr.message);
      }
    } else if (useSample || (!youtubeUrl && !uploadedFile)) {
      sourceType = 'sample';
      const sample = await getOrCreateSampleVideo();
      sourcePath = sample.path;
      videoDuration = sample.duration;
      if (!projectTitle) {
        projectTitle = 'Creator Masterclass: The Viral Content Blueprint';
      }
    } else if (youtubeUrl) {
      const ytId = extractYouTubeId(youtubeUrl);
      if (!ytId) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid YouTube URL (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...)',
        });
      }

      sourceType = 'youtube';
      if (!projectTitle) {
        projectTitle = `YouTube Video (${ytId})`;
      }

      // Per Section 5 rule:
      // Public YouTube URLs do not automatically grant download permissions.
      // Use authorized sample creator source for rendering while preserving YouTube URL and metadata.
      const sample = await getOrCreateSampleVideo();
      sourcePath = sample.path;
      videoDuration = sample.duration;
    }

    // Reserve credits
    await reserveCredits(req.user._id, requiredCredits, null, `Clip generation for "${projectTitle}"`);

    // Create Project
    const project = await Project.create({
      userId: req.user._id,
      youtubeUrl: youtubeUrl || '',
      title: projectTitle || 'Untitled Video Project',
      status: 'waiting',
      progress: 0,
      currentStep: 'Initializing clipping engine',
      videoDuration,
      settings: {
        clipsCount: parsedClipsCount,
        format: chosenFormat,
        captions: isCaptions,
      },
      sourceType,
      sourcePath,
      creditsReserved: requiredCredits,
      creditsDeducted: 0,
    });

    // Fire off async background processing
    setImmediate(() => {
      processProjectAsync(project._id).catch((err) => {
        console.error('Unhandled background worker error:', err);
      });
    });

    return res.status(201).json({
      success: true,
      message: 'Project created and queued for AI clipping.',
      project,
      creditsReserved: requiredCredits,
      remainingCredits: req.user.credits - requiredCredits,
    });
  } catch (err) {
    console.error('Create project error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Error creating video project.',
    });
  }
};

// GET /api/projects - Get all projects for current user
const getProjects = async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    // Attach clip counts to each project
    const projectIds = projects.map((p) => p._id);
    const clips = await Clip.find({ projectId: { $in: projectIds } }, 'projectId status').lean();

    const clipCounts = {};
    for (const c of clips) {
      clipCounts[c.projectId] = (clipCounts[c.projectId] || 0) + 1;
    }

    const enriched = projects.map((p) => ({
      ...p,
      clipsCount: clipCounts[p._id] || 0,
    }));

    return res.status(200).json({
      success: true,
      projects: enriched,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/projects/:id - Get project with clips
const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    // Ownership check (or admin)
    if (project.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const clips = await Clip.find({ projectId: project._id }).sort({ startTime: 1 });

    return res.status(200).json({
      success: true,
      project,
      clips,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/projects/:id - Delete project & its clips
const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (project.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Delete associated clips and files
    const clips = await Clip.find({ projectId: project._id });
    for (const clip of clips) {
      if (clip.videoPath && fs.existsSync(clip.videoPath)) {
        try { fs.unlinkSync(clip.videoPath); } catch (e) {}
      }
    }
    await Clip.deleteMany({ projectId: project._id });

    // Delete source upload if creator-uploaded
    if (project.sourceType === 'upload' && project.sourcePath && fs.existsSync(project.sourcePath)) {
      try { fs.unlinkSync(project.sourcePath); } catch (e) {}
    }

    await Project.findByIdAndDelete(project._id);

    return res.status(200).json({
      success: true,
      message: 'Project and all clips deleted successfully.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/projects/:id/retry - Retry failed project
const retryProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (project.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const requiredCredits = calculateCost(project.settings.clipsCount || 5);
    if (req.user.credits < requiredCredits) {
      return res.status(400).json({
        success: false,
        message: `Insufficient credits to retry. Required: ${requiredCredits}, Available: ${req.user.credits}`,
      });
    }

    // Reserve credits again
    await reserveCredits(req.user._id, requiredCredits, project._id, `Retry project "${project.title}"`);

    project.status = 'waiting';
    project.progress = 0;
    project.currentStep = 'Retrying project';
    project.errorMessage = '';
    project.creditsReserved = requiredCredits;
    await project.save();

    // Start background worker
    setImmediate(() => {
      processProjectAsync(project._id).catch((err) => console.error('Retry worker error:', err));
    });

    return res.status(200).json({
      success: true,
      message: 'Project queued for retry.',
      project,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  deleteProject,
  retryProject,
  processProjectAsync,
};
