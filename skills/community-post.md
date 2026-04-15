---
name: community-post
description: "Publish a creation to the StudioX community feed"
version: "1.0.0"
author: studiox-claw
triggers:
  - "post to community"
  - "share to community"
  - "publish"
  - "post this"
  - "share this"
args:
  - name: jobId
    required: true
    description: "Job ID to publish"
  - name: title
    required: false
    description: "Post title"
  - name: allowRemix
    required: false
    default: "true"
    description: "Allow others to remix"
cost_estimate: "0 credits"
channels:
  - telegram
  - discord
  - slack
  - web-chat
agent: social
---

# Community Post

Publish a completed generation to the StudioX community:
1. Verify the job belongs to the user
2. Create a post in Firestore posts/{postId}
3. Set allowRemix based on user preference
4. Return community post URL
