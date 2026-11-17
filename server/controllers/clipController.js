// server/controllers/clipController.js
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const Clip = require('../models/Clip');
const Project = require('../models/Project');
const {
  renderClip,
  enhanceClipTo1080p,
  resolveVideoFilePath,
  outputsDir,
} = require('../services/videoProcessor');

// GET /api/clips - Get all clips for current user (My Clips page)
const getAllUserClips = async (req, res) => {
  try {
    const clips = await Clip.find({ userId: req.user._id })
      .populate('projectId', 'title youtubeUrl status settings')
      .sort({ createdAt: -1 });

    // Verify clips actually exist on server storage
    const verifiedClips = [];
    for (const clip of clips) {
      const resolved = resolveVideoFilePath(clip.videoPath, clip.videoUrl);
      if (resolved) {
        if (clip.videoPath !== resolved) {
          clip.videoPath = resolved;
          clip.save().catch(() => {});
        }
        verifiedClips.push(clip);
      }
    }

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
    const verifiedClips = [];
    for (const clip of clips) {
      const resolved = resolveVideoFilePath(clip.videoPath, clip.videoUrl);
      if (resolved) {
        if (clip.videoPath !== resolved) {
          clip.videoPath = resolved;
          clip.save().catch(() => {});
        }
        verifiedClips.push(clip);
      }
    }

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
      return res.status(404).json({
        success: false,
        message: 'Clip not found in database.',
      });
    }

    // Verify user ownership before allowing downloads
    if (clip.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to download this clip.',
      });
    }

    const is1080p = quality === '1080p' || quality === 'enhanced';
    let targetPath = is1080p ? clip.enhancedVideoPath : clip.videoPath;
    let targetUrl = is1080p ? clip.enhancedVideoUrl : clip.videoUrl;

    if (is1080p && !targetPath && !targetUrl) {
      return res.status(404).json({
        success: false,
        message: 'Enhanced 1080p Full HD version is not available for this clip.',
      });
    }

    // Resolve cross-platform file path (handles Windows backslashes, relative paths, outputsDir)
    const resolvedPath = resolveVideoFilePath(targetPath, targetUrl);

    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      const typeLabel = is1080p ? 'Enhanced 1080p' : 'Original 720p';
      return res.status(404).json({
        success: false,
        message: `${typeLabel} video file not found on server storage.`,
      });
    }

    // Verify file is a valid non-empty regular file
    let stat;
    try {
      stat = fs.statSync(resolvedPath);
      if (!stat.isFile() || stat.size === 0) {
        return res.status(404).json({
          success: false,
          message: 'Clip video file on server is invalid or 0 bytes.',
        });
      }
    } catch (statErr) {
      return res.status(404).json({
        success: false,
        message: 'Unable to read clip video file from server storage.',
      });
    }

    // Heal database path if it was recorded differently (e.g. Windows separators)
    if (is1080p) {
      if (clip.enhancedVideoPath !== resolvedPath) {
        clip.enhancedVideoPath = resolvedPath;
        clip.save().catch(() => {});
      }
    } else {
      if (clip.videoPath !== resolvedPath) {
        clip.videoPath = resolvedPath;
        clip.save().catch(() => {});
      }
    }

    const safeTitle = (clip.title || 'clip').replace(/[^a-zA-Z0-9_-]/g, '_');
    const downloadFilename = is1080p
      ? `${safeTitle}_1080p.mp4`
      : `${safeTitle}_${(clip.format || '9:16').replace(':', 'x')}.mp4`;

    // Set correct Content-Type: video/mp4 and Content-Disposition headers
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache');

    const fileStream = fs.createReadStream(resolvedPath);
    fileStream.on('error', (streamErr) => {
      console.error('[ClipController] Streaming error:', streamErr);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Failed to stream video file.' });
      }
    });

    fileStream.pipe(res);
  } catch (err) {
    console.error('[ClipController] Download clip error:', err);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Internal server error downloading clip.',
      });
    }
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

    const originalPath = resolveVideoFilePath(clip.videoPath, clip.videoUrl);
    if (!originalPath || !fs.existsSync(originalPath)) {
      return res.status(400).json({ success: false, message: 'Original clip file not found on disk.' });
    }

    // If already enhanced and file exists, return directly
    const existingEnhanced = resolveVideoFilePath(clip.enhancedVideoPath, clip.enhancedVideoUrl);
    if (clip.enhancementStatus === 'completed' && existingEnhanced) {
      return res.status(200).json({
        success: true,
        message: 'Clip is already enhanced to 1080p.',
        clip,
      });
    }

    const enhancedFileName = path.basename(originalPath).replace('.mp4', '_1080p.mp4');
    const enhancedOutputPath = path.join(outputsDir, enhancedFileName);

    clip.enhancementStatus = 'processing';
    await clip.save();

    try {
      const enhanceRes = await enhanceClipTo1080p({
        inputClipPath: originalPath,
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

    const wantEnhanced = quality === '1080p' || quality === 'enhanced';

    // Verify each clip exists on disk using resolveVideoFilePath
    const validClipsWithPaths = [];
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      let chosenPath = null;
      let label = (clip.format || '9:16').replace(':', 'x');

      if (wantEnhanced && (clip.enhancedVideoPath || clip.enhancedVideoUrl)) {
        chosenPath = resolveVideoFilePath(clip.enhancedVideoPath, clip.enhancedVideoUrl);
        label = '1080p';
      }

      // Fallback to original if 1080p not found or not requested
      if (!chosenPath) {
        chosenPath = resolveVideoFilePath(clip.videoPath, clip.videoUrl);
        label = (clip.format || '9:16').replace(':', 'x');
      }

      if (chosenPath && fs.existsSync(chosenPath)) {
        validClipsWithPaths.push({ clip, path: chosenPath, label });
      }
    }

    if (validClipsWithPaths.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No completed video clip files are available on server storage for download.',
      });
    }

    const safeProjectName = (project.title || 'clipping_project').replace(/[^a-zA-Z0-9_-]/g, '_');
    const zipName = wantEnhanced ? `${safeProjectName}_1080p_clips.zip` : `${safeProjectName}_clips.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);

    archive.on('error', (err) => {
      console.error('[ClipController] Archiver error:', err);
      if (!res.headersSent) res.status(500).end();
    });

    validClipsWithPaths.forEach(({ clip, path: filePath, label }, index) => {
      const safeTitle = (clip.title || `clip_${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_');
      const clipFileName = `${index + 1}_${safeTitle}_${label}.mp4`;
      archive.file(filePath, { name: clipFileName });
    });

    await archive.finalize();
  } catch (err) {
    console.error('[ClipController] Download all ZIP error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: err.message });
    }
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
    const oldPath = resolveVideoFilePath(clip.videoPath, clip.videoUrl);
    if (oldPath && fs.existsSync(oldPath)) {
      try { fs.unlinkSync(oldPath); } catch (e) {}
    }
    const oldEnhanced = resolveVideoFilePath(clip.enhancedVideoPath, clip.enhancedVideoUrl);
    if (oldEnhanced && fs.existsSync(oldEnhanced)) {
      try { fs.unlinkSync(oldEnhanced); } catch (e) {}
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

    const origPath = resolveVideoFilePath(clip.videoPath, clip.videoUrl);
    if (origPath && fs.existsSync(origPath)) {
      try { fs.unlinkSync(origPath); } catch (e) {}
    }
    const enhPath = resolveVideoFilePath(clip.enhancedVideoPath, clip.enhancedVideoUrl);
    if (enhPath && fs.existsSync(enhPath)) {
      try { fs.unlinkSync(enhPath); } catch (e) {}
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
