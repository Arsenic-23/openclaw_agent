---
name: template-shadow-smoke
description: "Apply shadow smoke cinematic effect"
version: "1.0.0"
author: studiox-claw
triggers:
  - "shadow smoke"
  - "smoke effect"
  - "smoky effect"
  - "smoke template"
  - "dark smoke"
args:
  - name: subject
    required: true
    description: "What to apply the effect to"
  - name: aspect
    required: false
    default: "16:9"
cost_estimate: "45-75 credits"
channels:
  - telegram
  - discord
  - web-chat
agent: creative
---

# Shadow Smoke Template

Prompt template:
"{subject}, shrouded in dark volumetric smoke, mysterious atmosphere, cinematic,
noir lighting, deep shadows, fog machine effect, 4K, dramatic composition"

Model: kling-3.0/standard (video) or seedream-4.5 (image)
