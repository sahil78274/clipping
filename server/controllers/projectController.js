// server/controllers/projectController.js
const path = require('path');
const fs = require('fs');
const Project = require('../models/Project');
const Clip = require('../models/Clip');
const { analyzeVideoMoments } = require('../services/gemini');
const {
  getVideoMetadata,
  renderClip,
  enhanceClipTo1080p,
  outputsDir,
} = require('../services/videoProcessor');
const {
  calculateCost,
  reserveCredits,
  finalizeCredits,
  refundCredits,
} = require('../services/creditService');

// Duration preset lookup map
const DURATION_PRESETS = {
  '15-30s': { min: 15, max: 30 },
  '30-45s': { min: 30, max: 45 },
  '45-60s': { min: 45, max: 60 },
  '60-90s': { min: 60, max: 90 },
  '90-120s': { min: 90, max: 120 },
  '2-5m': { min: 120, max: 300 },
  '5-10m': { min: 300, max: 600 },
};

// Helper to validate and extract YouTube Video ID
function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i
  );
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
    project.status = 'Processing';
    project.currentStep = 'Validating source video file';
    project.progress = 15;
    await project.save();

    const sourcePath = project.sourcePath;
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      throw new Error('Authorized source video file does not exist on the server.');
    }

    const meta = await getVideoMetadata(sourcePath);
    const duration = meta.duration;
    if (!duration || duration < 3) {
      throw new Error('Source video duration is too short for clipping (minimum 3 seconds required).');
    }

    project.videoDuration = duration;
    await project.save();

    // Step 2: Send to Gemini for intelligent moment detection
    project.currentStep = 'Analyzing video with Gemini AI for best moments';
    project.progress = 30;
    await project.save();

    const clipsCount = project.settings?.clipsCount || 5;
    const minClipDuration = project.minClipDuration || project.settings?.minClipDuration || 60;
    const maxClipDuration = Math.min(600, project.maxClipDuration || project.settings?.maxClipDuration || 90);
    const selectedDurationPreset =
      project.selectedDurationPreset || project.settings?.selectedDurationPreset || '60-90s';

    const detectedMoments = await analyzeVideoMoments({
      title: project.title,
      description: project.youtubeUrl ? `YouTube Video: ${project.youtubeUrl}` : `Uploaded video: ${project.title}`,
      duration,
      clipsCount,
      videoPath: sourcePath,
      minClipDuration,
      maxClipDuration,
    });

    if (!detectedMoments || detectedMoments.length === 0) {
      throw new Error('No valid clip timestamps could be identified from this video.');
    }

    // Step 3: Render clips using FFmpeg
    project.currentStep = `Rendering ${detectedMoments.length} clips with FFmpeg`;
    project.progress = 45;
    await project.save();

    const createdClips = [];
    const totalClips = detectedMoments.length;
    const isQualityEnhancement = project.settings?.qualityEnhancement === '1080p';

    for (let i = 0; i < totalClips; i++) {
      const moment = detectedMoments[i];
      const clipIndex = i + 1;

      try {
        project.currentStep = `Rendering clip ${clipIndex} of ${totalClips}: "${moment.title}"`;
        project.progress = Math.min(85, Math.floor(45 + (i / totalClips) * (isQualityEnhancement ? 25 : 45)));
        await project.save();

        // Enforce strict 600s maximum per individual clip
        let startTime = Math.max(0, moment.startTime);
        let endTime = moment.endTime;
        if (endTime - startTime > 600) {
          endTime = startTime + 600;
        }

        const clipFileName = `clip_${project._id}_${clipIndex}_${Date.now()}.mp4`;
        const thumbFileName = `thumb_${project._id}_${clipIndex}_${Date.now()}.jpg`;

        const outputPath = path.join(outputsDir, clipFileName);
        const thumbnailPath = path.join(outputsDir, thumbFileName);

        const renderRes = await renderClip({
          inputPath: sourcePath,
          outputPath,
          thumbnailPath,
          startTime,
          endTime,
          format: project.settings?.format || '9:16',
          captions: project.settings?.captions !== false,
          title: moment.title,
        });

        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
          throw new Error(`Failed to render MP4 file for clip ${clipIndex}.`);
        }

        const actualClipDuration = renderRes.actualClipDuration || renderRes.duration;

        const clipData = {
          userId: project.userId,
          projectId: project._id,
          title: moment.title,
          description: moment.description || '',
          startTime,
          endTime,
          duration: actualClipDuration,
          actualClipDuration,
          minClipDuration,
          maxClipDuration,
          selectedDurationPreset,
          score: moment.score || 85,
          format: project.settings?.format || '9:16',
          captions: project.settings?.captions !== false,
          resolution:
            renderRes.resolution ||
            (project.settings?.format === '9:16' ? '720x1280' : '1280x720'),
          qualityEnhancement: isQualityEnhancement ? '1080p' : 'original',
          videoPath: outputPath,
          videoUrl: `/outputs/${clipFileName}`,
          thumbnailUrl: fs.existsSync(thumbnailPath) ? `/outputs/${thumbFileName}` : '',
          fileSize: renderRes.fileSize || 0,
          status: 'Completed',
          enhancementStatus: isQualityEnhancement ? 'processing' : 'none',
        };

        // Optional 1080p Full HD enhancement
        if (isQualityEnhancement) {
          try {
            project.currentStep = `Enhancing clip ${clipIndex} of ${totalClips} to Full HD (1080p)`;
            project.progress = Math.min(95, Math.floor(70 + (i / totalClips) * 25));
            await project.save();

            const enhancedFileName = `clip_${project._id}_${clipIndex}_1080p_${Date.now()}.mp4`;
            const enhancedOutputPath = path.join(outputsDir, enhancedFileName);

            const enhanceRes = await enhanceClipTo1080p({
              inputClipPath: outputPath,
              outputEnhancedPath: enhancedOutputPath,
              format: project.settings?.format || '9:16',
            });

            clipData.enhancedVideoPath = enhancedOutputPath;
            clipData.enhancedVideoUrl = `/outputs/${enhancedFileName}`;
            clipData.enhancedResolution = enhanceRes.resolution;
            clipData.enhancedFileSize = enhanceRes.fileSize;
            clipData.enhancementStatus = 'completed';
          } catch (enhanceErr) {
            console.error(`Clip ${clipIndex} 1080p enhancement error:`, enhanceErr.message);
            clipData.enhancementStatus = 'failed';
            clipData.enhancementError = enhanceErr.message || '1080p enhancement failed';
          }
        }

        const clip = await Clip.create(clipData);
        createdClips.push(clip);
      } catch (clipErr) {
        console.error(`[Project ${projectId}] Error processing clip ${clipIndex}:`, clipErr.message);
        // Preserve successfully generated clips even if one fails!
      }
    }

    if (createdClips.length === 0) {
      throw new Error('No clips could be successfully rendered.');
    }

    // Step 4: Finalize project & calculate accurate credit deduction
    const creditsToKeep = calculateCost(createdClips.length);
    const creditsToRefund = Math.max(0, creditsToDeduct - creditsToKeep);

    project.status = 'Completed';
    project.progress = 100;
    project.currentStep = isQualityEnhancement
      ? `${createdClips.length} clips generated and enhanced to 1080p successfully`
      : `${createdClips.length} clips generated successfully`;
    project.creditsDeducted = creditsToKeep;
    await project.save();

    if (creditsToRefund > 0) {
      await refundCredits(userId, creditsToRefund, project._id, 'Refund for unrendered clip moments');
    }
    await finalizeCredits(userId, creditsToKeep, project._id, createdClips.length);
    console.log(`[Project ${projectId}] Completed successfully with ${createdClips.length} genuine clips.`);
  } catch (err) {
    console.error(`[Project ${projectId}] Processing failed:`, err.message);

    project.status = 'Failed';
    project.currentStep = 'Processing failed';
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
    const {
      youtubeUrl,
      title,
      clipsCount = 5,
      minClipDuration,
      maxClipDuration,
      selectedDurationPreset,
      clipDuration,
      clipDurationMode,
      qualityEnhancement = 'original',
      format = '9:16',
      captions = true,
    } = req.body;
    const uploadedFile = req.file;

    // Check if user entered a YouTube URL without an authorized video file
    if (youtubeUrl && !uploadedFile) {
      return res.status(400).json({
        success: false,
        message:
          'Automated downloading of public YouTube URLs is not supported due to platform restrictions and copyright rules. Please upload your authorized creator video file (.mp4, .mov, .webm) to process clips.',
        requiresUpload: true,
      });
    }

    // Must have an uploaded file
    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an authorized video file (.mp4, .mov, .webm, .mkv).',
      });
    }

    const sourcePath = uploadedFile.path;
    if (!fs.existsSync(sourcePath)) {
      return res.status(400).json({
        success: false,
        message: 'Uploaded file could not be stored on the server.',
      });
    }

    // Probe uploaded video file to verify it is valid
    let videoDuration = 0;
    try {
      const meta = await getVideoMetadata(sourcePath);
      videoDuration = meta.duration;
      if (!videoDuration || videoDuration < 3) {
        try { fs.unlinkSync(sourcePath); } catch (e) {}
        return res.status(400).json({
          success: false,
          message: 'Uploaded video is too short. Minimum duration of 3 seconds is required.',
        });
      }
    } catch (probeErr) {
      try { fs.unlinkSync(sourcePath); } catch (e) {}
      return res.status(400).json({
        success: false,
        message: `Invalid video file: ${probeErr.message}`,
      });
    }

    // Parse Duration Preset and Min/Max Duration
    let min = 60;
    let max = 90;
    let preset = selectedDurationPreset || clipDurationMode || '60-90s';

    if (preset === 'custom' || (!preset && minClipDuration && maxClipDuration)) {
      preset = 'custom';
      min = parseInt(minClipDuration, 10);
      max = parseInt(maxClipDuration, 10);
    } else if (DURATION_PRESETS[preset]) {
      min = DURATION_PRESETS[preset].min;
      max = DURATION_PRESETS[preset].max;
    } else if (clipDuration) {
      // Backwards compatibility with previous single duration value
      const parsedDur = parseInt(clipDuration, 10) || 30;
      min = Math.max(15, parsedDur - 5);
      max = Math.min(600, parsedDur + 5);
      preset = 'custom';
    } else {
      min = 60;
      max = 90;
      preset = '60-90s';
    }

    // Strict validation
    if (isNaN(min) || min < 15 || min > 600) {
      try { fs.unlinkSync(sourcePath); } catch (e) {}
      return res.status(400).json({
        success: false,
        message: 'Minimum clip duration must be between 15 and 600 seconds.',
      });
    }

    if (isNaN(max) || max < 15 || max > 600) {
      try { fs.unlinkSync(sourcePath); } catch (e) {}
      return res.status(400).json({
        success: false,
        message: 'Maximum clip duration must be between 15 and 600 seconds (10 minutes maximum).',
      });
    }

    if (max < min) {
      try { fs.unlinkSync(sourcePath); } catch (e) {}
      return res.status(400).json({
        success: false,
        message: 'Maximum duration must be greater than or equal to minimum duration.',
      });
    }

    // Handle source video shorter than selected duration
    if (videoDuration < min) {
      try { fs.unlinkSync(sourcePath); } catch (e) {}
      return res.status(400).json({
        success: false,
        message: `Source video duration (${Math.round(videoDuration)}s) is shorter than the minimum requested clip duration (${min}s). Please select a shorter duration preset or upload a longer video.`,
      });
    }

    const validEnhancements = ['original', '1080p'];
    const chosenEnhancement = validEnhancements.includes(qualityEnhancement) ? qualityEnhancement : 'original';

    const parsedClipsCount = Math.min(20, Math.max(1, parseInt(clipsCount, 10) || 5));
    const validFormats = ['9:16', '16:9', '1:1'];
    const chosenFormat = validFormats.includes(format) ? format : '9:16';
    const isCaptions = captions === 'true' || captions === true || captions === 'on';

    // Credit calculation & check
    const requiredCredits = calculateCost(parsedClipsCount);
    if (req.user.credits < requiredCredits) {
      try { fs.unlinkSync(sourcePath); } catch (e) {}
      return res.status(400).json({
        success: false,
        message: `Insufficient credits. This project requires ${requiredCredits} credits, but you have ${req.user.credits} credits.`,
        requiredCredits,
        availableCredits: req.user.credits,
      });
    }

    let projectTitle = (title || '').trim();
    if (!projectTitle) {
      projectTitle = path.parse(uploadedFile.originalname).name;
    }

    // Reserve credits
    await reserveCredits(req.user._id, requiredCredits, null, `Clip generation for "${projectTitle}"`);

    // Create Project in database with Queued status
    const project = await Project.create({
      userId: req.user._id,
      youtubeUrl: youtubeUrl || '',
      title: projectTitle || 'Untitled Video Project',
      status: 'Queued',
      progress: 0,
      currentStep: 'Queued in processing pipeline',
      videoDuration,
      minClipDuration: min,
      maxClipDuration: max,
      selectedDurationPreset: preset,
      settings: {
        clipsCount: parsedClipsCount,
        minClipDuration: min,
        maxClipDuration: max,
        selectedDurationPreset: preset,
        clipDuration: Math.round((min + max) / 2),
        clipDurationMode: preset,
        qualityEnhancement: chosenEnhancement,
        format: chosenFormat,
        captions: isCaptions,
      },
      sourceType: 'upload',
      sourcePath,
      creditsReserved: requiredCredits,
      creditsDeducted: 0,
    });

    // Start background processing
    setImmediate(() => {
      processProjectAsync(project._id).catch((err) => {
        console.error('Unhandled background worker error:', err);
      });
    });

    return res.status(201).json({
      success: true,
      message: 'Project created and queued for processing.',
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

    const projectIds = projects.map((p) => p._id);
    const clips = await Clip.find({ projectId: { $in: projectIds } }, 'projectId status videoPath').lean();

    const clipCounts = {};
    for (const c of clips) {
      if (fs.existsSync(c.videoPath)) {
        clipCounts[c.projectId] = (clipCounts[c.projectId] || 0) + 1;
      }
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

// GET /api/projects/:id - Get project details with clips
const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (project.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const clips = await Clip.find({ projectId: project._id }).sort({ startTime: 1 });
    const verifiedClips = clips.filter((c) => c.videoPath && fs.existsSync(c.videoPath));

    return res.status(200).json({
      success: true,
      project,
      clips: verifiedClips,
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

    if (project.status !== 'Failed' && project.status !== 'failed') {
      return res.status(400).json({ success: false, message: 'Only failed projects can be retried.' });
    }

    const requiredCredits = calculateCost(project.settings?.clipsCount || 5);
    if (req.user.credits < requiredCredits) {
      return res.status(400).json({
        success: false,
        message: `Insufficient credits. Need ${requiredCredits} credits to retry.`,
      });
    }

    await reserveCredits(req.user._id, requiredCredits, project._id, `Retry project: ${project.title}`);

    project.status = 'Queued';
    project.progress = 0;
    project.currentStep = 'Retrying project';
    project.errorMessage = '';
    project.creditsReserved = requiredCredits;
    await project.save();

    setImmediate(() => {
      processProjectAsync(project._id).catch((err) => {
        console.error('Retry worker error:', err);
      });
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

// DELETE /api/projects/:id - Delete project and its clips
const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (project.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const clips = await Clip.find({ projectId: project._id });
    for (const clip of clips) {
      if (clip.videoPath && fs.existsSync(clip.videoPath)) {
        try { fs.unlinkSync(clip.videoPath); } catch (e) {}
      }
      if (clip.enhancedVideoPath && fs.existsSync(clip.enhancedVideoPath)) {
        try { fs.unlinkSync(clip.enhancedVideoPath); } catch (e) {}
      }
    }

    await Clip.deleteMany({ projectId: project._id });

    if (project.sourcePath && fs.existsSync(project.sourcePath)) {
      try { fs.unlinkSync(project.sourcePath); } catch (e) {}
    }

    await Project.findByIdAndDelete(project._id);

    return res.status(200).json({
      success: true,
      message: 'Project and associated files deleted.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  retryProject,
  deleteProject,
  processProjectAsync,
};
