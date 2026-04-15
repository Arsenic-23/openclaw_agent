---
name: template-mouth-in
description: "Zoom into mouth revealing an entire world inside"
version: "1.0.0"
author: studiox-claw
triggers:
  - "mouth in"
  - "world inside mouth"
  - "zoom into mouth"
  - "mouth world"
args:
  - name: world
    required: false
    default: "a vast ocean"
    description: "What world exists inside"
  - name: subject
    required: false
    default: "a person"
cost_estimate: "48-100 credits"
channels:
  - telegram
  - discord
  - web-chat
agent: creative
---

# Mouth In Template

Prompt template:
"Close up of {subject}'s open mouth, camera flies into it revealing {world} inside,
surreal dreamlike transition, cinematic, smooth motion, 4K, jaw-dropping visual"

Model: sora-2 for best transition quality
