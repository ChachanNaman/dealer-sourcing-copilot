# Dealer Sourcing Co-pilot

Full README (what it is, architecture diagram, metrics, how to run) is written
at Phase 9. This section exists early so implementation decisions aren't lost
before then.

## Implementation notes

- **LLM provider: Groq, model `openai/gpt-oss-120b`.** Originally specced
  against Anthropic/OpenAI; switched to Groq because that's the only paid key
  available for this build. `llama-3.3-70b-versatile` (the originally planned
  model) has been retired on Groq, and there is no Llama 70B of any version
  left on the account's model list. `openai/gpt-oss-120b` is the closest
  current large instruct model that supports `json_mode` — picked for that
  reason, not for any particular quality benchmark. See `api/app/intent.py`.
