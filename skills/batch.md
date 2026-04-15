---
name: batch
description: "Generate multiple variations in one request"
version: "1.0.0"
author: studiox-claw
triggers:
  - "batch generate"
  - "generate multiple"
  - "make 3"
  - "make 4"
  - "make 5"
  - "generate 3"
  - "generate 4"
  - "generate 5"
  - "5 variations"
  - "3 variations"
args:
  - name: prompt
    required: true
    description: "What to generate"
  - name: count
    required: false
    default: "4"
    description: "Number of images (1-10)"
  - name: model
    required: false
    default: "seedream-4"
    description: "Model (seedream-4 supports up to 15)"
cost_estimate: "20-100 credits"
channels:
  - telegram
  - discord
  - slack
  - web-chat
agent: creative
---

# Batch Generation

Generate multiple variations of the same prompt:
1. Confirm count and total cost (count × per-image cost)
2. Use seedream-4 which supports n=1-15 in one job
3. Deliver all images as an album
4. Show total cost and per-image cost breakdown
