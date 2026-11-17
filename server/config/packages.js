// server/config/packages.js

const DEFAULT_PACKAGES = [
  {
    id: 'free',
    name: 'FREE',
    credits: 20,
    price: 0,
    currency: 'INR',
    description: 'Welcome gift for every new user. Try clipping risk-free.',
    isPopular: false,
    features: ['20 Free Credits', 'Standard 9:16, 16:9, 1:1', 'AI Highlight Analysis', 'No Watermark']
  },
  {
    id: 'starter',
    name: 'STARTER',
    credits: 100,
    price: 49,
    currency: 'INR',
    description: 'Perfect for casual creators testing short-form content.',
    isPopular: false,
    features: ['100 High-Speed Credits', 'Up to 50 Short Clips', 'Auto Captions', 'HD MP4 Export']
  },
  {
    id: 'basic',
    name: 'BASIC',
    credits: 250,
    price: 99,
    currency: 'INR',
    description: 'Great for weekly podcasters and active YouTubers.',
    isPopular: false,
    features: ['250 High-Speed Credits', 'Up to 125 Short Clips', 'Custom Subtitles', 'Bulk ZIP Download']
  },
  {
    id: 'pro',
    name: 'PRO',
    credits: 600,
    price: 199,
    currency: 'INR',
    description: 'Most popular for growing creators & digital marketing agencies.',
    isPopular: true,
    features: ['600 Credits (Best Value)', 'Up to 300 Short Clips', 'Priority AI Rendering', 'Bulk ZIP Export', 'Timestamp Fine-Tuning']
  },
  {
    id: 'premium',
    name: 'PREMIUM',
    credits: 1400,
    price: 399,
    currency: 'INR',
    description: 'For high-volume media teams and production agencies.',
    isPopular: false,
    features: ['1,400 Massive Credits', 'Up to 700 Short Clips', 'Ultra-Fast Queueing', 'Unlimited Re-renders', 'Admin Support']
  }
];

// 2 credits per generated clip (e.g., 5 clips = 10 credits)
const CREDIT_COST_PER_CLIP = 2;

module.exports = {
  DEFAULT_PACKAGES,
  CREDIT_COST_PER_CLIP,
};
