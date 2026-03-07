# hackomania26

## build extension

bun i
bun run build
load unpacked dist in the directory

## build backend

bun i
bun dev
docker run \
  --rm \
  --detach \
  --publish 8000:8000 \
  --name speaches \
  --volume hf-hub-cache:/home/ubuntu/.cache/huggingface/hub \
  ghcr.io/speaches-ai/speaches:latest-cpu
uvx speaches-cli model download Systran/faster-distil-whisper-medium.en
uvx speaches-cli model download "speaches-ai/Kokoro-82M-v1.0-ONNX"

whisper on localhost:8000
api: https://speaches.ai/api/

## chrome extension that connects to backend for popup and ai spam detection

## challenge statement

- How might we design AI-powered solutions that help local and multilingual communities in Singapore assess information credibility, understand context, and make informed decisions especially during times of uncertainty?

- screenshot image drag drop into extension @grok is this true

- multilingual transcription