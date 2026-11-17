// server/services/videoProcessor.js
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const path = require('path');
const fs = require('fs');

// Configure ffmpeg & ffprobe paths
const ffmpegPath = ffmpegInstaller.path || 'ffmpeg';
const ffprobePath = ffprobeInstaller.path || 'ffprobe';
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const outputsDir = path.join(__dirname, '../outputs');
const uploadsDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Locate font file
const fontCandidates = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  'Arial',
];
let chosenFont = 'sans-serif';
for (const f of fontCandidates) {
  if (fs.existsSync(f)) {
    chosenFont = f;
    break;
  }
}

/**
 * Probes video file and extracts technical metadata
 */
function getVideoMetadata(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);

      const format = metadata.format || {};
      const videoStream = (metadata.streams || []).find((s) => s.codec_type === 'video') || {};
      const audioStream = (metadata.streams || []).find((s) => s.codec_type === 'audio');

      const duration = parseFloat(format.duration || videoStream.duration || 0);
      const width = parseInt(videoStream.width || 1280, 10);
      const height = parseInt(videoStream.height || 720, 10);

      let fps = 30;
      if (videoStream.r_frame_rate) {
        const parts = videoStream.r_frame_rate.split('/');
        if (parts.length === 2 && parseFloat(parts[1]) > 0) {
          fps = Math.round(parseFloat(parts[0]) / parseFloat(parts[1]));
        }
      }

      resolve({
        duration,
        width,
        height,
        fps: fps || 30,
        formatName: format.format_name,
        size: format.size,
        hasAudio: !!audioStream,
      });
    });
  });
}

/**
 * Creates or retrieves the default authorized sample video for testing
 */
async function getOrCreateSampleVideo() {
  const samplePath = path.join(uploadsDir, 'sample_creator_authorized_video.mp4');

  if (fs.existsSync(samplePath)) {
    try {
      const meta = await getVideoMetadata(samplePath);
      if (meta.duration >= 30) {
        return {
          path: samplePath,
          title: 'Creator Masterclass: The Viral Content Blueprint',
          duration: meta.duration,
          metadata: meta,
        };
      }
    } catch (e) {
      // Re-generate if corrupted
    }
  }

  console.log('[VideoProcessor] Generating high-quality authorized sample creator video (60s)...');

  // Generate 60-second multi-scene creator video with sound and visual markers
  return new Promise((resolve, reject) => {
    const fontStr = chosenFont.startsWith('/') ? `:fontfile=${chosenFont}` : '';

    // Create 60s video with timer, title and audio beep/harmony
    const vf = [
      `drawtext=text='CLIPPING CREATOR MASTERCLASS'${fontStr}:fontcolor=0x22C55E:fontsize=34:x=(w-text_w)/2:y=60:box=1:boxcolor=0x090D0B@0.8:boxborderw=10`,
      `drawtext=text='%{pts\\:gmtime\\:0\\:%M\\\\\\:%S}'${fontStr}:fontcolor=white:fontsize=72:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=0x151C18@0.9:boxborderw=20`,
      `drawtext=text='Long Videos. Best Moments.'${fontStr}:fontcolor=0xA1A1AA:fontsize=24:x=(w-text_w)/2:y=h-100:box=1:boxcolor=0x090D0B@0.8:boxborderw=8`,
    ].join(',');

    ffmpeg()
      .input('testsrc=duration=60:size=1280x720:rate=30')
      .inputFormat('lavfi')
      .input('sine=frequency=440:duration=60:beep_factor=4')
      .inputFormat('lavfi')
      .videoFilters(vf)
      .outputOptions([
        '-c:v libx264',
        '-preset ultrafast',
        '-pix_fmt yuv420p',
        '-c:a aac',
        '-b:a 128k',
        '-movflags +faststart',
        '-shortest',
      ])
      .output(samplePath)
      .on('end', async () => {
        console.log('[VideoProcessor] Sample creator video generated successfully at:', samplePath);
        const meta = await getVideoMetadata(samplePath);
        resolve({
          path: samplePath,
          title: 'Creator Masterclass: The Viral Content Blueprint',
          duration: meta.duration,
          metadata: meta,
        });
      })
      .on('error', (err) => {
        console.error('[VideoProcessor] Error creating sample video:', err);
        reject(err);
      })
      .run();
  });
}

/**
 * Extracts a poster frame JPEG thumbnail from video at specified timestamp
 */
function extractThumbnail(videoPath, thumbnailPath, timeInSeconds = 1) {
  return new Promise((resolve) => {
    ffmpeg(videoPath)
      .seekInput(Math.max(0, timeInSeconds))
      .frames(1)
      .output(thumbnailPath)
      .outputOptions(['-vf scale=480:-1', '-q:v 3'])
      .on('end', () => resolve(true))
      .on('error', (err) => {
        console.warn('[VideoProcessor] Thumbnail extraction warning:', err.message);
        resolve(false);
      })
      .run();
  });
}

/**
 * Renders an individual clip using FFmpeg
 */
function renderClip({
  inputPath,
  outputPath,
  thumbnailPath,
  startTime,
  endTime,
  format = '9:16',
  captions = true,
  title = '',
}) {
  return new Promise((resolve, reject) => {
    const duration = Math.max(1, endTime - startTime);
    const fontStr = chosenFont.startsWith('/') ? `:fontfile=${chosenFont}` : '';

    // Build video filter chain for aspect ratio
    const filters = [];

    if (format === '9:16') {
      // Smart crop to 9:16 center, then scale to 720x1280
      filters.push('crop=ih*9/16:ih:(iw-ih*9/16)/2:0', 'scale=720:1280:flags=lanczos');
    } else if (format === '1:1') {
      // Smart crop to 1:1 center, then scale to 720x720
      filters.push('crop=min(iw\\,ih):min(iw\\,ih):(iw-min(iw\\,ih))/2:(ih-min(iw\\,ih))/2', 'scale=720:720:flags=lanczos');
    } else {
      // 16:9 standard
      filters.push('scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black');
    }

    // Burn-in captions/hook overlay if captions enabled
    if (captions && title) {
      // Clean up title text for FFmpeg drawtext
      const sanitizedText = title
        .replace(/['"\\]/g, '')
        .replace(/:/g, ' - ')
        .trim();

      const fontSize = format === '9:16' ? 32 : 28;
      const yPosition = format === '9:16' ? 'h-240' : 'h-110';

      filters.push(
        `drawtext=text='${sanitizedText}'${fontStr}:fontcolor=white:fontsize=${fontSize}:x=(w-text_w)/2:y=${yPosition}:box=1:boxcolor=0x090D0B@0.85:boxborderw=14`
      );
    }

    const command = ffmpeg(inputPath)
      .seekInput(startTime)
      .duration(duration)
      .videoFilters(filters)
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 22',
        '-pix_fmt yuv420p',
        '-c:a aac',
        '-b:a 128k',
        '-movflags +faststart',
      ])
      .output(outputPath);

    command
      .on('start', (cmd) => {
        console.log(`[VideoProcessor] Rendering clip (${format}, ${duration}s): ${outputPath}`);
      })
      .on('end', async () => {
        try {
          // Generate thumbnail
          if (thumbnailPath) {
            await extractThumbnail(outputPath, thumbnailPath, Math.min(1.5, duration / 2));
          }

          const stats = fs.statSync(outputPath);
          resolve({
            outputPath,
            duration,
            fileSize: stats.size,
          });
        } catch (postErr) {
          resolve({
            outputPath,
            duration,
            fileSize: 0,
          });
        }
      })
      .on('error', (err) => {
        console.error('[VideoProcessor] FFmpeg rendering error:', err.message);
        reject(err);
      });

    command.run();
  });
}

module.exports = {
  getVideoMetadata,
  getOrCreateSampleVideo,
  extractThumbnail,
  renderClip,
  outputsDir,
  uploadsDir,
};
