// server/services/gemini.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { detectVideoMoments } = require('./videoProcessor');

/**
 * Validate and sanitize clip timestamps against real video duration
 */
function sanitizeClips(rawClips, videoDuration, requestedCount, projectTitle = 'Clip') {
  if (!Array.isArray(rawClips) || rawClips.length === 0) {
    return [];
  }

  const duration = Math.max(5, Math.floor(videoDuration));
  const validClips = [];

  for (let i = 0; i < rawClips.length; i++) {
    const item = rawClips[i];
    let start = Math.max(0, Math.floor(Number(item.startTime) || 0));
    let end = Math.floor(Number(item.endTime) || (start + 25));

    if (end <= start) {
      end = Math.min(duration, start + 25);
    }

    if (start >= duration) continue;
    if (end > duration) end = duration;

    const clipDuration = end - start;
    if (clipDuration < 3) continue;

    const title = String(item.title || `${projectTitle} - Moment ${i + 1}`).trim().slice(0, 100);
    const description = String(item.description || `Engaging highlight from ${start}s to ${end}s`).trim().slice(0, 300);
    const score = Math.min(99, Math.max(60, Math.floor(Number(item.score) || 85)));

    validClips.push({
      startTime: start,
      endTime: end,
      duration: end - start,
      title,
      description,
      score,
    });
  }

  // Remove overlapping clips
  validClips.sort((a, b) => b.score - a.score);
  const nonOverlapping = [];
  for (const clip of validClips) {
    const overlaps = nonOverlapping.some(
      (c) => Math.max(clip.startTime, c.startTime) < Math.min(clip.endTime, c.endTime)
    );
    if (!overlaps) {
      nonOverlapping.push(clip);
    }
    if (nonOverlapping.length >= requestedCount) break;
  }

  nonOverlapping.sort((a, b) => a.startTime - b.startTime);
  return nonOverlapping;
}

/**
 * Main AI Analysis function using Gemini API
 * @param {Object} options
 * @param {string} options.title - Project/video title
 * @param {string} options.description - Video context/description
 * @param {number} options.duration - Video duration in seconds
 * @param {number} options.clipsCount - Requested number of clips
 * @param {string} options.videoPath - Absolute path to actual source video file on disk
 * @returns {Promise<Array>} List of clips with { startTime, endTime, title, description, score }
 */
async function analyzeVideoMoments({ title, description = '', duration = 60, clipsCount = 5, videoPath = '' }) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const modelName = process.env.GEMINI_MODEL?.trim() || 'gemini-1.5-flash';

  if (!duration || duration <= 0) {
    throw new Error('Invalid source video duration for analysis.');
  }

  // If Gemini API Key is configured, attempt analysis via Gemini API
  if (apiKey) {
    try {
      console.log(`[Gemini] Sending video metadata to Gemini (${modelName})...`);
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      });

      const prompt = `
You are an expert video editor.
Analyze this video metadata and identify the top ${clipsCount} most engaging moments to create short clips from:

VIDEO METADATA:
- Title: "${title}"
- Description/Context: "${description.slice(0, 1000)}"
- Duration: ${Math.floor(duration)} seconds (${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s)

RULES:
1. Identify high-interest timestamps strictly between 0 and ${Math.floor(duration)} seconds.
2. Clip duration must be between 10 and 60 seconds (or shorter if total video is under 60s).
3. Provide descriptive, contextual titles for each clip.
4. Avoid overlapping timestamps.
5. Return JSON ONLY in this format:
{
  "clips": [
    {
      "startTime": 5,
      "endTime": 25,
      "title": "Clear descriptive title",
      "description": "Why this moment is engaging",
      "score": 92
    }
  ]
}
`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      console.log('[Gemini] Received response from Gemini API.');

      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch (parseErr) {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      }

      if (parsed) {
        const rawClips = parsed.clips || (Array.isArray(parsed) ? parsed : []);
        const sanitized = sanitizeClips(rawClips, duration, clipsCount, title);
        if (sanitized.length > 0) {
          console.log(`[Gemini] Successfully parsed ${sanitized.length} moments from Gemini.`);
          return sanitized;
        }
      }
    } catch (err) {
      console.warn(`[Gemini] Gemini API call was not successful: ${err.message}`);
    }
  } else {
    console.log('[Gemini] GEMINI_API_KEY not set. Analyzing actual video scene/audio boundaries with FFmpeg.');
  }

  // If Gemini was not configured or unreachable, analyze genuine scene cuts/timestamps of the actual video file
  if (videoPath) {
    console.log('[VideoProcessor] Analyzing genuine scene/audio boundaries on source video file...');
    const detected = await detectVideoMoments(videoPath, duration, clipsCount);
    if (detected && detected.length > 0) {
      return detected.map((m, idx) => ({
        startTime: m.startTime,
        endTime: m.endTime,
        duration: m.duration,
        title: `${title} - Clip ${idx + 1}`,
        description: `Highlight segment from ${m.startTime}s to ${m.endTime}s`,
        score: m.score,
      }));
    }
  }

  throw new Error('Unable to extract valid clip timestamps from the source video.');
}

module.exports = {
  analyzeVideoMoments,
  sanitizeClips,
};
