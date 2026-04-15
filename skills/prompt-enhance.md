---
name: prompt-enhance
description: "AI-improve a raw prompt before generation"
version: "1.0.0"
author: studiox-claw
triggers:
  - "enhance prompt"
  - "improve my prompt"
  - "make prompt better"
  - "enhance:"
args:
  - name: prompt
    required: true
    description: "The raw prompt to enhance"
cost_estimate: "0 credits"
channels:
  - telegram
  - discord
  - slack
  - web-chat
agent: creative
---

# Prompt Enhancement

Take the user's raw prompt and improve it by adding:
- Style descriptors (cinematic, photorealistic, etc.)
- Lighting descriptions (golden hour, studio lighting, etc.)
- Camera/composition hints (wide angle, shallow DOF, etc.)
- Quality tags (8K, sharp focus, highly detailed)

Return the enhanced prompt and ask if they want to generate with it.
