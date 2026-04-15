---
name: template-earth-zoom
description: "Epic earth zoom out cinematic effect"
version: "1.0.0"
author: studiox-claw
triggers:
  - "earth zoom"
  - "zoom out to earth"
  - "planet zoom"
  - "space zoom"
  - "zoom to space"
args:
  - name: subject
    required: true
    description: "Starting location or subject"
  - name: aspect
    required: false
    default: "16:9"
cost_estimate: "45-100 credits"
channels:
  - telegram
  - discord
  - web-chat
agent: creative
---

# Earth Zoom Template

Prompt template:
"Starting from {subject}, camera pulls back dramatically through clouds, atmosphere,
revealing the curvature of Earth from space, epic cinematic zoom out, 4K, IMAX quality"

Model: sora-2 preferred for smooth zoom motion
