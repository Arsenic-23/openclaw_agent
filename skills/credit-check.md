---
name: credit-check
description: "Check user's credit balance"
version: "1.0.0"
author: studiox-claw
triggers:
  - "how many credits"
  - "my credits"
  - "check credits"
  - "credit balance"
  - "my balance"
  - "/credits"
  - "/balance"
args: []
cost_estimate: "0 credits"
channels:
  - telegram
  - discord
  - slack
  - whatsapp
  - web-chat
agent: admin
---

# Credit Check

Show the user their current credit balance from Firestore users/{uid}.tokenBalance.

Format:
💰 Your balance: X credits

Also show:
- Cheapest thing they can generate with current balance
- Link to pricing if balance is low (<500cr)
