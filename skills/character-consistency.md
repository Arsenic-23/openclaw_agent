---
name: character-consistency
description: "Create and maintain consistent characters across generations"
version: "1.0.0"
author: studiox-claw
triggers:
  - "create character"
  - "save character"
  - "use character"
  - "consistent character"
  - "character profile"
args:
  - name: characterName
    required: true
    description: "Name of the character"
  - name: description
    required: false
    description: "Physical description to save"
cost_estimate: "5-20 credits"
channels:
  - telegram
  - discord
  - web-chat
agent: creative
---

# Character Consistency

Save and reuse character descriptions for consistent results:
1. Save character: store description in claw_memory/{uid}.characters.{name}
2. Use character: inject saved description into any generation prompt
3. This ensures the same character looks the same across multiple generations
