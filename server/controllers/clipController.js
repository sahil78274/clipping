// server/controllers/clipController.js
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const Clip = require('../models/Clip');
const Project = require('../models/Project');
const { renderClip, outputsDir } = require('../services/videoProcessor');

// GET /api/clips - Get all clips for current user (My Clips page)
const getAllUserClips = async (req, res) => {
  try {
    const clips = await Clip.find({ userId: req.user._id })
      .populate('projectId', 'title youtubeUrl status')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      clips,
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

    return res.status(200).json({
      success: true,
      clips,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/clips/download/:clipId - Download single MP4
const downloadClip = async (req, res) => {
  try {
    const { clipId } = req.params;
    const clip = await Clip.findById(clipId);
    if (!clip) {
      return res.status(404).json({ success: false, message: 'Clip not found.' });
    }

    if (clip.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (!fs.existsSync(clip.videoPath)) {
      return res.status(404).json({ success: false, message: 'Clip file is not found on disk.' });
    }

    const safeTitle = (clip.title || 'clip').replace(/[^a-zA-Z0-9_-]/g, '_');
    const downloadName = `${safeTitle}_${clip.format.replace(':', 'x')}.mp4`;

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);

    const fileStream = fs.createReadStream(clip.videoPath);
    fileStream.pipe(res);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/clips/download-all/:projectId - Download all clips as ZIP
const downloadAllClipsAsZip = async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (project.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const clips = await Clip.find({ projectId, status: 'completed' });
    if (!clips || clips.length === 0) {
      return res.status(400).json({ success: false, message: 'No completed clips available for download.' });
    }

    const safeProjectName = (project.title || 'clipping_project').replace(/[^a-zA-Z0-9_-]/g, '_');
    const zipName = `${safeProjectName}_clips.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);

    archive.on('error', (err) => {
      console.error('Archiver error:', err);
      res.status(500).end();
    });

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      if (clip.videoPath && fs.existsSync(clip.videoPath)) {
        const safeTitle = (clip.title || `clip_${i + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        const clipFileName = `${i + 1}_${safeTitle}.mp4`;
        archive.file(clip.videoPath, { name: clipFileName });
      }
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
    clip.title = newTitle;
    clip.videoPath = newOutputPath;
    clip.videoUrl = `/outputs/${newClipFileName}`;
    clip.thumbnailUrl = `/outputs/${newThumbFileName}`;
    clip.fileSize = renderRes.fileSize || 0;
    clip.status = 'completed';
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
  downloadAllClipsAsZip,
  rerenderClip,
  deleteClip,
};
