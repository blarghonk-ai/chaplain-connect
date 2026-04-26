# Ollama Cloud Deployment

Ollama runs your AI models privately — no data leaves your infrastructure.

## Option A: Fly.io (Recommended for Chaplain Connect)

Fly.io is the easiest cloud option with persistent storage and global regions.

```bash
# 1. Install fly CLI
brew install flyctl

# 2. Login
fly auth login

# 3. Create the app
fly launch --config fly.toml --no-deploy

# 4. Create persistent volume for models (~4GB for llama3.2)
fly volumes create ollama_models --size 20 --region iad

# 5. Deploy
fly deploy

# 6. Pull the model (run once after deploy)
fly ssh console -C "ollama pull llama3.2"

# 7. Get your URL
# It will be: https://chaplain-ollama.fly.dev
```

Then set in Vercel:
```
OLLAMA_URL=https://chaplain-ollama.fly.dev
OLLAMA_MODEL=llama3.2
```

---

## Option B: Any VPS with Docker (DigitalOcean, Hetzner, Linode)

```bash
# On your VPS:
git clone https://github.com/blarghonk-ai/chaplain-connect
cd chaplain-connect/docker/ollama
docker compose up -d

# Pull model
docker exec chaplain-ollama ollama pull llama3.2

# Your Ollama URL: http://YOUR_SERVER_IP:11434
```

Recommended VPS specs:
- **CPU-only (budget)**: 4 vCPU, 8GB RAM, ~$40/month (DigitalOcean General droplet)
- **GPU (faster)**: DigitalOcean GPU Droplet or Hetzner Cloud GPU

---

## Option C: Local Docker (development only)

```bash
cd docker/ollama
docker compose up -d
# Ollama available at http://localhost:11434
```

---

## Available Models

| Model | Size | Use case |
|-------|------|----------|
| `llama3.2` | 2GB | Default — fast, good quality |
| `mistral` | 4GB | Better reasoning |
| `llama3.1:8b` | 5GB | Best quality on CPU |

Pull a model: `ollama pull <model-name>`

Change the model in Vercel: `OLLAMA_MODEL=mistral`
