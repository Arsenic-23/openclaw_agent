---
name: remix
description: "Remix an existing creation with variations"
version: "1.0.0"
author: studiox-claw
triggers:
  - "remix"
  - "remix this"
  - "remix job:"
  - "make variations"
  - "create variations"
args:
  - name: jobId
    required: true
    description: "Job ID to remix"
  - name: strength
    required: false
    default: "0.7"
    description: "Remix strength 0.1-1.0"
  - name: prompt
    required: false
    description: "New prompt direction for remix"
cost_estimate: "5-20 credits"
channels:
  - telegram
  - discord
  - slack
  - whatsapp
  - web-chat
agent: creative
---

# Remix

Take an existing generation and create variations:
1. Load original job parameters from Firestore
2. Apply remix strength (how much to change)
3. Apply new prompt direction if provided
4. Generate with same model as original
5. Return remix result with comparison
