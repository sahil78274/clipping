// server/routes/clipRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllUserClips,
  getClipsByProject,
  downloadClip,
  downloadEnhancedClip,
  enhanceClip,
  downloadAllClipsAsZip,
  rerenderClip,
  deleteClip,
} = require('../controllers/clipController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.get('/', getAllUserClips);
router.get('/download/:clipId', downloadClip);
router.get('/download-enhanced/:clipId', downloadEnhancedClip);
router.get('/download-all/:projectId', downloadAllClipsAsZip);
router.get('/:projectId', getClipsByProject);
router.get('/project/:projectId', getClipsByProject);
router.post('/:clipId/enhance', enhanceClip);
router.patch('/:clipId/rerender', rerenderClip);
router.delete('/:clipId', deleteClip);

module.exports = router;
