---
name: video-gen
description: "Generate videos using StudioX's 12 AI video models"
version: "1.0.0"
author: studiox-claw
triggers:
  - "generate video"
  - "generate a video"
  - "create video"
  - "create a video"
  - "make a video"
  - "make video"
  - "video of"
  - "animate"
  - "cinematic video"
args:
  - name: prompt
    required: true
    description: "What to generate"
  - name: model
    required: false
    default: "kling-3.0/standard"
    description: "Video model to use"
  - name: aspect
    required: false
    default: "16:9"
    description: "Aspect ratio (16:9, 9:16, 1:1)"
  - name: duration
    required: false
    default: "5"
    description: "Duration in seconds (3-15)"
  - name: quality
    required: false
    default: "720p"
    description: "Quality (720p, 1080p)"
cost_estimate: "45-100 credits"
channels:
  - telegram
  - discord
  - slack
  - whatsapp
  - web-chat
agent: creative
---

# Video Generation

When the user asks to generate a video:

1. Extract prompt, aspect ratio, duration from their message
2. Default to kling-3.0/standard (45cr) for budget, sora-2 for quality requests
3. Confirm cost if >50 credits before generating
4. Deliver video file with credit summary

## Model Selection Guide
- kling-3.0/standard: Best value, 3-15s, 720p (45cr)
- kling-3.0/pro: High quality, 3-15s, 1080p (75cr)
- sora-2: Best quality, 10-15s (48cr base)
- sora-2-pro: Premium, 15-25s (100cr)
- veo3.1-fast: Fast turnaround, 720p (20-80cr)

## Aspect Ratio Guide
- 16:9: Landscape/YouTube/cinematic
- 9:16: Reels/TikTok/Stories
- 1:1: Social media square
