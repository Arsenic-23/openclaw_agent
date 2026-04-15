---
name: template-animalization
description: "Transform a subject into an animal hybrid or spirit animal"
version: "1.0.0"
author: studiox-claw
triggers:
  - "animalize"
  - "animalization"
  - "animal transformation"
  - "turn into animal"
  - "animal spirit"
  - "spirit animal"
args:
  - name: subject
    required: true
    description: "Person or subject to transform"
  - name: animal
    required: false
    default: "wolf"
    description: "Animal to transform into"
cost_estimate: "5-20 credits"
channels:
  - telegram
  - discord
  - web-chat
agent: creative
---

# Animalization Template

Prompt template:
"{subject} transformed into a majestic {animal}, hybrid human-animal form,
detailed fur/scales/feathers, cinematic portrait, dramatic lighting, fantasy art style, 4K"

Model: flux-2-pro for artistic quality
