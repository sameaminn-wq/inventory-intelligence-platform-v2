# Multi-Image Shelf Analysis

## Core interpretation
A capture session may contain several photos taken from different angles of the same physical shelf. They are complementary observations—not independent inventory counts.

## Required records
For each image, preserve:
- original private object reference and capture metadata;
- analysis provider/model/version and processing timestamp;
- each detection's bounding box, candidate identity, confidence, and source image;
- processing errors and review decisions.

Across images, create explicit match groups that link candidate detections believed to represent the same physical product instance or shelf region. Preserve per-image detections even after matching.

## Reconciliation rules
1. Analyze each view independently first.
2. Match across views using visual features, position/context, packaging, and available identifiers.
3. Keep match confidence separate from product-identity confidence.
4. Do not merge solely because text/name/brand matches.
5. Do not add per-image counts together; duplicate views may show the same physical units.
6. Mark uncertain or conflicting matches for human review.
7. Preserve unmatched detections rather than forcing a match.
8. Require explicit approval before inventory changes.

## Output concepts
A detection should distinguish:
- candidate product identity;
- visible physical instance/region;
- estimated quantity in the view, if supported;
- confidence and uncertainty;
- image provenance and bounding box;
- cross-view match group and match confidence;
- review status.

Avoid claiming exact stock counts where occlusion, perspective, reflections, or incomplete shelf coverage make that impossible.

## Evaluation
Build a labeled test set across stores, lighting, camera distances, product types, occlusion, and view overlap. Measure precision/recall for detection, product identification accuracy, cross-view duplicate matching, quantity error, and human correction rate. Track performance by category and confidence band. Model/provider changes require regression evaluation.

## Human review
Provide a review UI that lets authorized staff inspect source crops and all contributing views, accept/correct/reject candidates, resolve duplicate matches, and see the resulting inventory impact before committing.
