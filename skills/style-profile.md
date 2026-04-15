---
name: style-profile
description: "Save and load user style preferences"
version: "1.0.0"
author: studiox-claw
triggers:
  - "save my style"
  - "set my default"
  - "remember my preference"
  - "set default model"
  - "my style"
  - "/setstyle"
args:
  - name: preference
    required: false
    description: "What to set (model, aspect, quality, style)"
  - name: value
    required: false
    description: "The value to set"
cost_estimate: "0 credits"
channels:
  - telegram
  - discord
  - slack
  - web-chat
agent: admin
---

# Style Profile

Save and retrieve user style preferences in claw_memory/{uid}:
- preferredModel: default generation model
- preferredAspect: default aspect ratio
- preferredQuality: default quality setting
- promptStyle: default style keywords to append

Show current profile if no preference specified.
