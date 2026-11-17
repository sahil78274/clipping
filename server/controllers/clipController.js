// server/controllers/clipController.js
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const Clip = require('../models/Clip');
const Project = require('../models/Project');
const { renderClip, enhanceClipTo1080p, outputsDir } = require('../services/videoProcessor');

// GET /api/clips - Get all clips for current user (My Clips page)
const getAllUserClips = async (req, res) => {
  try {
    const clips = await Clip.find({ userId: req.user._id })
      .populate('projectId', 'title youtubeUrl status settings')
      .sort({ createdAt: -1 });

    // Only return clips that actually exist on disk
    const verifiedClips = clips.filter((c) => c.videoPath && fs.existsSync(c.videoPath));

    return res.status(200).json({
      success: true,
      clips: verifiedClips,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/clips/:projectId - Get clips for specific project
const getClipsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (project.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const clips = await Clip.find({ projectId }).sort({ startTime: 1 });
    const verifiedClips = clips.filter((c) => c.videoPath && fs.existsSync(c.videoPath));

    return res.status(200).json({
      success: true,
      clips: verifiedClips,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/clips/download/:clipId - Download single MP4 (original or 1080p enhanced via ?quality=1080p)
const downloadClip = async (req, res) => {
  try {
    const { clipId } = req.params;
    const { quality } = req.query;

    const clip = await Clip.findById(clipId);
    if (!clip) {
      return res.status(404).json({ success: false, message: 'Clip not found.' });
    }

    if (clip.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const safeTitle = (clip.title || 'clip').replace(/[^a-zA-Z0-9_-]/g, '_');

    // If enhanced 1080p version is requested
    if (quality === '1080p' || quality === 'enhanced') {
      if (!clip.enhancedVideoPath || !fs.existsSync(clip.enhancedVideoPath)) {
        return res.status(404).json({
          success: false,
          message: 'Enhanced 1080p Full HD version is not available for this clip.',
        });
      }

      const downloadName = `${safeTitle}_1080p.mp4`;
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);

      const fileStream = fs.createReadStream(clip.enhancedVideoPath);
      return fileStream.pipe(res);
    }

    // Default: Original clip
    if (!fs.existsSync(clip.videoPath)) {
      return res.status(404).json({ success: false, message: 'Clip file is not found on disk.' });
    }

    const downloadName = `${safeTitle}_${(clip.format || '9:16').replace(':', 'x')}.mp4`;
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);

    const fileStream = fs.createReadStream(clip.videoPath);
    fileStream.pipe(res);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/clips/download-enhanced/:clipId - Explicit download route for 1080p enhanced MP4
const downloadEnhancedClip = async (req, res) => {
  req.query.quality = '1080p';
  return downloadClip(req, res);
};

// POST /api/clips/:clipId/enhance - On-demand 1080p Full HD enhancement for an existing clip
const enhanceClip = async (req, res) => {
  try {
    const { clipId } = req.params;
    const clip = await Clip.findById(clipId);
    if (!clip) {
      return res.status(404).json({ success: false, message: 'Clip not found.' });
    }

    if (clip.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (!clip.videoPath || !fs.existsSync(clip.videoPath)) {
      return res.status(400).json({ success: false, message: 'Original clip file not found on disk.' });
    }

    // If already enhanced and file exists, return directly
    if (clip.enhancementStatus === 'completed' && clip.enhancedVideoPath && fs.existsSync(clip.enhancedVideoPath)) {
      return res.status(200).json({
        success: true,
        message: 'Clip is already enhanced to 1080p.',
        clip,
      });
    }

    const enhancedFileName = path.basename(clip.videoPath).replace('.mp4', '_1080p.mp4');
    const enhancedOutputPath = path.join(outputsDir, enhancedFileName);

    clip.enhancementStatus = 'processing';
    await clip.save();

    try {
      const enhanceRes = await enhanceClipTo1080p({
        inputClipPath: clip.videoPath,
        outputEnhancedPath: enhancedOutputPath,
        format: clip.format || '9:16',
      });

      clip.qualityEnhancement = '1080p';
      clip.enhancedVideoPath = enhancedOutputPath;
      clip.enhancedVideoUrl = `/outputs/${enhancedFileName}`;
      clip.enhancedResolution = enhanceRes.resolution;
      clip.enhancedFileSize = enhanceRes.fileSize;
      clip.enhancementStatus = 'completed';
      clip.enhancementError = '';
      await clip.save();

      return res.status(200).json({
        success: true,
        message: 'Clip enhanced to 1080p Full HD successfully.',
        clip,
      });
    } catch (enhanceErr) {
      clip.enhancementStatus = 'failed';
      clip.enhancementError = enhanceErr.message || '1080p enhancement failed.';
      await clip.save();

      return res.status(500).json({
        success: false,
        message: `Enhancement failed: ${enhanceErr.message}`,
        clip,
      });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/clips/download-all/:projectId - Download all clips as ZIP
const downloadAllClipsAsZip = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { quality } = req.query;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (project.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const clips = await Clip.find({
      projectId,
      status: { $in: ['Completed', 'completed'] },
    });
    const verifiedClips = clips.filter((c) => c.videoPath && fs.existsSync(c.videoPath));

    if (!verifiedClips || verifiedClips.length === 0) {
      return res.status(400).json({ success: false, message: 'No completed clips available for download.' });
    }

    const wantEnhanced = quality === '1080p' || quality === 'enhanced';
    const safeProjectName = (project.title || 'clipping_project').replace(/[^a-zA-Z0-9_-]/g, '_');
    const zipName = wantEnhanced ? `${safeProjectName}_1080p_clips.zip` : `${safeProjectName}_clips.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);

    archive.on('error', (err) => {
      console.error('Archiver error:', err);
      res.status(500).end();
    });

    for (let i = 0; i < verifiedClips.length; i++) {
      const clip = verifiedClips[i];
      const safeTitle = (clip.title || `clip_${i + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_');

      // Use enhanced path if requested and available, else original
      let filePathToZip = clip.videoPath;
      let label = (clip.format || '9:16').replace(':', 'x');

      if (wantEnhanced && clip.enhancedVideoPath && fs.existsSync(clip.enhancedVideoPath)) {
        filePathToZip = clip.enhancedVideoPath;
        label = '1080p';
      }

      const clipFileName = `${i + 1}_${safeTitle}_${label}.mp4`;
      archive.file(filePathToZip, { name: clipFileName });
    }

    await archive.finalize();
  } catch (err) {
    console.error('Download all ZIP error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/clips/:clipId/rerender - Edit timestamps and re-render clip
const rerenderClip = async (req, res) => {
  try {
    const { clipId } = req.params;
    const { startTime, endTime, title } = req.body;

    const clip = await Clip.findById(clipId);
    if (!clip) {
      return res.status(404).json({ success: false, message: 'Clip not found.' });
    }

    if (clip.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const project = await Project.findById(clip.projectId);
    if (!project || !project.sourcePath || !fs.existsSync(project.sourcePath)) {
      return res.status(400).json({ success: false, message: 'Source video for this project is no longer available.' });
    }

    const start = Math.max(0, parseFloat(startTime));
    const end = parseFloat(endTime);

    if (isNaN(start) || isNaN(end) || end <= start) {
      return res.status(400).json({ success: false, message: 'Invalid start and end times.' });
    }

    if (end - start < 3) {
      return res.status(400).json({ success: false, message: 'Clip duration must be at least 3 seconds.' });
    }

    if (end - start > 600) {
      return res.status(400).json({ success: false, message: 'Individual clip duration cannot exceed 10 minutes (600 seconds).' });
    }

    const newTitle = title ? title.trim() : clip.title;

    // Generate new file paths
    const newClipFileName = `clip_${project._id}_edited_${Date.now()}.mp4`;
    const newThumbFileName = `thumb_${project._id}_edited_${Date.now()}.jpg`;
    const newOutputPath = path.join(outputsDir, newClipFileName);
    const newThumbnailPath = path.join(outputsDir, newThumbFileName);

    // Delete old files if they exist
    if (clip.videoPath && fs.existsSync(clip.videoPath)) {
      try { fs.unlinkSync(clip.videoPath); } catch (e) {}
    }
    if (clip.enhancedVideoPath && fs.existsSync(clip.enhancedVideoPath)) {
      try { fs.unlinkSync(clip.enhancedVideoPath); } catch (e) {}
      clip.enhancedVideoPath = '';
      clip.enhancedVideoUrl = '';
      clip.enhancementStatus = 'none';
    }

    const renderRes = await renderClip({
      inputPath: project.sourcePath,
      outputPath: newOutputPath,
      thumbnailPath: newThumbnailPath,
      startTime: start,
      endTime: end,
      format: clip.format || project.settings.format || '9:16',
      captions: clip.captions !== false,
      title: newTitle,
    });

    clip.startTime = start;
    clip.endTime = end;
    clip.duration = renderRes.duration;
    clip.actualClipDuration = renderRes.actualClipDuration || renderRes.duration;
    clip.title = newTitle;
    clip.videoPath = newOutputPath;
    clip.videoUrl = `/outputs/${newClipFileName}`;
    clip.thumbnailUrl = `/outputs/${newThumbFileName}`;
    clip.fileSize = renderRes.fileSize || 0;
    clip.resolution = renderRes.resolution;
    clip.status = 'Completed';

    // If clip was previously enhanced or project specified 1080p, re-enhance
    if (clip.qualityEnhancement === '1080p') {
      try {
        const enhancedFileName = `clip_${project._id}_edited_1080p_${Date.now()}.mp4`;
        const enhancedOutputPath = path.join(outputsDir, enhancedFileName);

        const enhanceRes = await enhanceClipTo1080p({
          inputClipPath: newOutputPath,
          outputEnhancedPath: enhancedOutputPath,
          format: clip.format || '9:16',
        });

        clip.enhancedVideoPath = enhancedOutputPath;
        clip.enhancedVideoUrl = `/outputs/${enhancedFileName}`;
        clip.enhancedResolution = enhanceRes.resolution;
        clip.enhancedFileSize = enhanceRes.fileSize;
        clip.enhancementStatus = 'completed';
      } catch (enhErr) {
        console.error('Re-render enhancement failed:', enhErr.message);
        clip.enhancementStatus = 'failed';
        clip.enhancementError = enhErr.message;
      }
    }

    await clip.save();

    return res.status(200).json({
      success: true,
      message: 'Clip re-rendered successfully with updated timestamps.',
      clip,
    });
  } catch (err) {
    console.error('Rerender clip error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/clips/:clipId - Delete individual clip
const deleteClip = async (req, res) => {
  try {
    const { clipId } = req.params;
    const clip = await Clip.findById(clipId);
    if (!clip) {
      return res.status(404).json({ success: false, message: 'Clip not found.' });
    }

    if (clip.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (clip.videoPath && fs.existsSync(clip.videoPath)) {
      try { fs.unlinkSync(clip.videoPath); } catch (e) {}
    }
    if (clip.enhancedVideoPath && fs.existsSync(clip.enhancedVideoPath)) {
      try { fs.unlinkSync(clip.enhancedVideoPath); } catch (e) {}
    }

    await Clip.findByIdAndDelete(clipId);

    return res.status(200).json({
      success: true,
      message: 'Clip deleted successfully.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAllUserClips,
  getClipsByProject,
  downloadClip,
  downloadEnhancedClip,
  enhanceClip,
  downloadAllClipsAsZip,
  rerenderClip,
  deleteClip,
};
