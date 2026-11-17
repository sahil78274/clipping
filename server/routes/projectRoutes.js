// server/routes/projectRoutes.js
const express = require('express');
const router = express.Router();
const {
  createProject,
  getProjects,
  getProjectById,
  deleteProject,
  retryProject,
} = require('../controllers/projectController');
const { verifyToken } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { projectCreateLimiter } = require('../middleware/rateLimiter');

router.use(verifyToken);

router.post('/', projectCreateLimiter, upload.single('videoFile'), createProject);
router.get('/', getProjects);
router.get('/:id', getProjectById);
router.delete('/:id', deleteProject);
router.post('/:id/retry', retryProject);

module.exports = router;
