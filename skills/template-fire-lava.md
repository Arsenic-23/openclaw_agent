---
name: template-fire-lava
description: "Apply fire and lava cinematic effect to a subject"
version: "1.0.0"
author: studiox-claw
triggers:
  - "fire lava"
  - "lava effect"
  - "fire effect"
  - "fire template"
  - "surrounded by fire"
  - "engulfed in flames"
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

# Fire Lava Template

Apply cinematic fire and lava effects:

Prompt template:
"{subject}, surrounded by flowing lava and fire, cinematic lighting, dramatic, volcanic,
4K, film grain, shallow depth of field, orange and red color grade, epic scene"

Model: kling-3.0/standard (video) or flux-2-pro (image)
