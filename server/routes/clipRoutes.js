// server/routes/clipRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllUserClips,
  getClipsByProject,
  downloadClip,
  downloadAllClipsAsZip,
  rerenderClip,
  deleteClip,
} = require('../controllers/clipController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.get('/', getAllUserClips);
router.get('/download/:clipId', downloadClip);
router.get('/download-all/:projectId', downloadAllClipsAsZip);
router.get('/:projectId', getClipsByProject);
router.get('/project/:projectId', getClipsByProject);
router.patch('/:clipId/rerender', rerenderClip);
router.delete('/:clipId', deleteClip);

module.exports = router;
