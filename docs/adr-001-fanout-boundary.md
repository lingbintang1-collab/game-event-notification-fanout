# ADR 001: Publish one message per recipient

Status: accepted

The service expands a live event into one queue message per subscriber. Each message owns its recipient and channel. A worker can acknowledge delivery independently, and a slow channel does not hold the rest of the audience.

Player-generated assets take a different route. They produce one moderation review message before any subscriber notification exists. That is the business boundary this repository protects.

The real gotcha is retry identity. A network retry must keep the same key, so the key includes the source event, player, and channel. Moderation uses the source event alone because it creates one review request.
