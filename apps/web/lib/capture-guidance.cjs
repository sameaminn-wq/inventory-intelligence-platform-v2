/**
 * Device-independent capture guidance policy.
 *
 * This module does not access camera or motion APIs. A browser/native adapter
 * supplies normalized measurements so the policy can be unit-tested and
 * calibrated per device. Never treat missing sensor data as zero movement.
 */
const DEFAULT_THRESHOLDS = Object.freeze({
  motionPause: 0.75,
  motionSlow: 0.45,
  blurMinimum: 0.4,
  glareMaximum: 0.3,
  clippedPixelMaximum: 0.25,
  coverageComplete: 0.95,
  overlapMinimum: 0.15,
  overlapMaximum: 0.65,
});

function isUnitInterval(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function evaluateCaptureFrame(measurements, overrides = {}) {
  if (!measurements || typeof measurements !== 'object' || Array.isArray(measurements)) {
    throw new TypeError('Capture measurements are required');
  }

  const thresholds = { ...DEFAULT_THRESHOLDS, ...overrides };
  for (const [key, value] of Object.entries(thresholds)) {
    if (!isUnitInterval(value)) throw new TypeError(`Threshold ${key} must be between 0 and 1`);
  }

  const { motionScore, blurScore, glareRatio, clippedPixelRatio, coverageRatio, overlapRatio } = measurements;
  for (const [key, value] of Object.entries({ motionScore, blurScore, glareRatio, clippedPixelRatio, coverageRatio })) {
    if (value !== undefined && value !== null && !isUnitInterval(value)) {
      throw new TypeError(`${key} must be between 0 and 1 when supplied`);
    }
  }
  if (overlapRatio !== undefined && overlapRatio !== null && !isUnitInterval(overlapRatio)) {
    throw new TypeError('overlapRatio must be between 0 and 1 when supplied');
  }

  const reasons = [];
  let action = 'capture';
  let message = 'الصورة جاهزة للفحص. التقط الصورة.';

  // Image evidence has priority: motion sensors alone must never approve a frame.
  if (blurScore !== undefined && blurScore !== null && blurScore < thresholds.blurMinimum) {
    action = 'retake';
    reasons.push('BLUR_TOO_HIGH');
    message = 'الصورة غير واضحة. ثبّت الهاتف وأعد التصوير.';
  } else if (glareRatio !== undefined && glareRatio !== null && glareRatio > thresholds.glareMaximum) {
    action = 'retake';
    reasons.push('GLARE_TOO_HIGH');
    message = 'يوجد انعكاس يغطي المنتجات. غيّر زاوية الهاتف أو الإضاءة.';
  } else if (clippedPixelRatio !== undefined && clippedPixelRatio !== null &&
             clippedPixelRatio > thresholds.clippedPixelMaximum) {
    action = 'retake';
    reasons.push('EXPOSURE_CLIPPING');
    message = 'الإضاءة قوية أو ضعيفة في أجزاء من الصورة. عدّل الإضاءة وأعد التصوير.';
  } else if (motionScore !== undefined && motionScore !== null && motionScore >= thresholds.motionPause) {
    action = 'pause';
    reasons.push('DEVICE_MOVING_TOO_FAST');
    message = 'توقف لحظة حتى يثبت الهاتف، ثم التقط الصورة.';
  } else if (motionScore !== undefined && motionScore !== null && motionScore >= thresholds.motionSlow) {
    action = 'slow_down';
    reasons.push('DEVICE_MOVING');
    message = 'تحرك ببطء أكبر وحافظ على ثبات الهاتف.';
  }

  if (overlapRatio !== undefined && overlapRatio !== null) {
    if (overlapRatio < thresholds.overlapMinimum) {
      reasons.push('INSUFFICIENT_VIEW_OVERLAP');
      if (action === 'capture') {
        action = 'adjust_position';
        message = 'ارجع قليلًا لتتداخل الصورة الجديدة مع الجزء السابق.';
      }
    } else if (overlapRatio > thresholds.overlapMaximum) {
      reasons.push('EXCESSIVE_VIEW_OVERLAP');
      if (action === 'capture') {
        action = 'move_forward';
        message = 'هذه المنطقة صُوّرت كثيرًا. تحرك إلى الجزء التالي.';
      }
    }
  }

  if (coverageRatio !== undefined && coverageRatio !== null &&
      coverageRatio >= thresholds.coverageComplete && action === 'capture') {
    action = 'complete';
    message = 'اكتملت تغطية الرف وفق القياسات الحالية. راجع الصور قبل الإرسال.';
  } else if (coverageRatio !== undefined && coverageRatio !== null &&
             coverageRatio < thresholds.coverageComplete) {
    reasons.push('SHELF_NOT_FULLY_COVERED');
  }

  const sensorStatus = motionScore === undefined || motionScore === null ? 'unavailable' : 'available';
  const imageQualityStatus = blurScore === undefined || blurScore === null ? 'unmeasured' : 'measured';

  return Object.freeze({
    action,
    message,
    reasons: Object.freeze([...new Set(reasons)]),
    sensorStatus,
    imageQualityStatus,
    requiresHumanReview: action === 'complete' || action === 'capture',
  });
}

module.exports = { DEFAULT_THRESHOLDS, evaluateCaptureFrame };
