---
name: upscale
description: "Upscale an image to higher resolution (up to 4K)"
version: "1.0.0"
author: studiox-claw
triggers:
  - "upscale"
  - "make it 4k"
  - "increase resolution"
  - "higher quality"
  - "upscale this"
args:
  - name: jobId
    required: true
    description: "Job ID to upscale"
  - name: target
    required: false
    default: "4K"
    description: "Target resolution (2K or 4K)"
cost_estimate: "10-20 credits"
channels:
  - telegram
  - discord
  - web-chat
agent: creative
---

# Upscale

Upscale a completed image generation to higher resolution:
1. Load original job from Firestore
2. Re-run with 2K or 4K quality setting
3. Return upscaled result
