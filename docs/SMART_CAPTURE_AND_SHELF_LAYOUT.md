# Smart Capture, Physical Aids and Shelf Layout

**Status:** Implementation plan and capture-guidance policy prototype. Hardware integrations and computer-vision measurements are not yet implemented.

## Product rules

- A camera observes visible evidence; it cannot prove the number of units fully hidden behind an opaque front row.
- Keep product identity, physical-instance matching, visible count, estimated stock and verified stock as separate concepts.
- Never sum detections from different views without instance-level reconciliation.
- Sensor readings guide capture; they do not establish image quality or inventory truth.
- Missing device sensor permissions/data mean "unavailable", never zero motion.
- All AI proposals remain subject to authorized human review before stock movement.

## Capture workflow

1. Create one capture session for one store and one shelf/location.
2. Ask the employee to capture a wide context image, then overlapping close views of shelf sections.
3. Read camera frames and, when permission is granted, motion/orientation sensor samples.
4. Measure blur, glare, exposure/clipping, image dimensions and coverage from actual frames.
5. Use motion measurements as guidance only. A steady phone can still produce an unusable image; a moving phone can occasionally produce a sharp frame.
6. Ask the employee to pause, slow down, change angle, move forward, or retake based on evidence.
7. Preserve original images and capture metadata; derived crops must retain source-image coordinates.
8. Analyze each view, then reconcile physical instances across views.
9. Mark occluded/hidden stock as unknown unless separately verified.
10. Present evidence and uncertainty to an authorized reviewer before any inventory adjustment.

## Suggested normalized frame measurements

All ratio/score fields use 0..1 and must be calibrated against a labeled device/store dataset:

```ts
type CaptureMeasurements = {
  motionScore?: number | null;       // normalized motion magnitude, device-adapter-defined
  blurScore?: number | null;         // 1 = sharper; calibrated per resolution/device
  glareRatio?: number | null;        // fraction of relevant shelf region affected
  clippedPixelRatio?: number | null;// clipped highlights/shadows in region of interest
  coverageRatio?: number | null;     // estimated unique shelf area covered
  overlapRatio?: number | null;      // overlap with previous accepted view
};
```

The initial `apps/web/lib/capture-guidance.cjs` is a pure decision policy. It does not read browser APIs, capture frames, or claim that its provisional thresholds are scientifically calibrated. Camera and sensor adapters must supply measurements and handle permission denial.

## Shelf arrangement and quantity contract

For each product observation, future analysis should preserve:
- candidate product identity and identity confidence;
- source image and normalized bounding box;
- visible instance count only when distinguishable;
- arrangement hypothesis: front-facing, horizontal row, vertical stack, deep row, mixed, irregular, unknown;
- occlusion status and visible fraction when measurable;
- cross-view instance-match references and separate match confidence;
- estimated depth only when supported by calibrated geometry/depth sensing;
- visible quantity, estimated total quantity and verified quantity as distinct fields;
- review reasons and evidence provenance.

Do not infer the number of hidden packages from the number of visible package fronts. Shelf depth, package dimensions, camera pose and occlusion can make depth estimates ambiguous. A side view can add evidence but does not guarantee a complete count.

## Physical aids: staged recommendation

### Stage 1 — low-cost, no custom hardware
- Smartphone with a usable autofocus camera.
- Stable two-hand grip or simple phone clamp/mini tripod for close-ups.
- Diffused portable LED light; avoid pointing a bare light directly at glossy packaging.
- Optional removable neutral reference card for color/scale calibration in controlled pilot images.
- Printed shelf/section identifier (QR code) to bind the capture to the correct shelf, not to identify or track employees.

### Stage 2 — optional measurement aids
- Bluetooth barcode scanner for products whose barcode is accessible.
- Known-size calibration marker placed temporarily in the same plane as the shelf for scale estimation.
- Fixed phone mount for repeatable front/side views.
- External depth sensor only after a device compatibility and accuracy pilot.

### Stage 3 — specialist equipment only if justified
- Depth camera / stereo camera for geometry experiments.
- Polarizing filter only after testing with packaging materials; it can reduce some reflections but may also reduce light and fail on certain surfaces.
- Fixed multi-camera shelf station for high-throughput warehouses, not the default small-store workflow.

Do not require a proprietary camera or paid hardware for the first usable version.

## Software implementation stages

1. Unit-tested capture guidance policy (implemented prototype).
2. Browser camera preview and explicit permission handling.
3. Frame-based blur/glare/exposure measurements and device calibration.
4. DeviceMotion/DeviceOrientation adapter with unsupported/permission-denied fallback.
5. Shelf-section coverage and overlap tracking using image features/optical flow.
6. Barcode capture and catalog lookup behind authorized API boundaries.
7. Arrangement/occlusion output schema and human-review UI.
8. Labeled real-store benchmark before quantity automation.

## Validation and acceptance

Test on multiple phone models and real shelf layouts:
- employee stationary, walking slowly and walking quickly;
- autofocus transitions, motion blur and rolling-shutter artifacts;
- bright glare, low light and mixed color temperatures;
- front rows, deep rows, vertical stacks, mixed arrangements and partial occlusion;
- repeated views, insufficient overlap and missing shelf sections;
- sensor permission denied, browser unsupported and app background/resume;
- network loss and retry without duplicate capture submission.

Track frame-retake precision, missed blur/glare, coverage recall, duplicate-instance matching, visible-count error, human correction rate and time per shelf. Thresholds must be tuned on labeled examples, not treated as universal constants.

## Hardware safety and privacy

Use stable mounts that do not obstruct aisles or create trip hazards. Do not ask staff to climb shelving or move heavy stock to obtain a camera angle. Capture shelf/product evidence only; do not build employee route tracking or retain unnecessary faces/audio. Follow store consent and image-retention policies.
