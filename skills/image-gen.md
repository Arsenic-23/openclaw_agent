---
name: image-gen
description: "Generate images using StudioX's 15 AI models"
version: "1.0.0"
author: studiox-claw
triggers:
  - "generate image"
  - "generate a photo"
  - "generate an image"
  - "create image"
  - "create a photo"
  - "create an image"
  - "make an image"
  - "make a photo"
  - "image of"
  - "photo of"
  - "/imagine"
args:
  - name: prompt
    required: true
    description: "What to generate"
  - name: model
    required: false
    default: "seedream-4.5"
    description: "AI model to use"
  - name: aspect
    required: false
    default: "1:1"
    description: "Aspect ratio (1:1, 16:9, 9:16, 4:3)"
  - name: quality
    required: false
    default: "1K"
    description: "Output quality (1K, 2K, 4K)"
cost_estimate: "5-20 credits"
channels:
  - telegram
  - discord
  - slack
  - whatsapp
  - web-chat
agent: creative
---

# Image Generation

When the user asks to generate an image:

1. Extract the prompt from their message
2. Use their preferred model (or seedream-4.5 as default)
3. Apply their preferred aspect ratio from memory
4. Call createStudioJob with model, prompt, aspect, quality
5. Deliver result with credit summary and quick actions

## Model Selection Guide
- seedream-4.5: Best for general images, portraits, products (5cr)
- flux-2-pro: Best for artistic/creative prompts (6cr)
- gpt-4o-image: Best for photorealistic results (4cr)
- seedream-4: Best for batch generation, up to 15 at once (5cr base)

## Prompt Enhancement
Add style keywords based on context:
- Product photos: "white background, studio lighting, sharp focus"
- Portraits: "natural lighting, shallow depth of field"
- Landscapes: "golden hour, cinematic, wide angle"
