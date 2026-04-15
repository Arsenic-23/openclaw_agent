---
name: smart-model-picker
description: "Auto-select the cheapest model that meets requirements"
version: "1.0.0"
author: studiox-claw
triggers:
  - "cheapest model"
  - "best model for"
  - "which model"
  - "suggest a model"
args:
  - name: type
    required: true
    description: "image or video"
  - name: requirements
    required: false
    description: "quality, speed, or budget"
cost_estimate: "0 credits"
channels:
  - telegram
  - discord
  - slack
  - web-chat
agent: creative
---

# Smart Model Picker

Analyze user requirements and recommend the best model:

## For Images (budget → quality):
1. gpt-4o-image — 4cr — photorealistic, general
2. seedream-4.5 — 5cr — versatile, recommended default
3. flux-2-pro — 6cr — artistic, creative
4. flux-kontext-max — 10cr — advanced

## For Videos (budget → quality):
1. veo3.1-fast — 20cr base — fastest
2. kling-3.0/standard — 45cr — best value
3. sora-2 — 48cr — high quality
4. kling-3.0/pro — 75cr — professional
5. sora-2-pro — 100cr — premium

Pick the cheapest model that meets the user's stated quality/speed requirements.
