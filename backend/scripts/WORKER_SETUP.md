# Video Worker — Oracle Cloud Always Free setup

Runs `backend/scripts/video_worker.py` 24/7 on a free Oracle VM so video rendering doesn't depend
on your Mac. The worker polls the `video_jobs` Supabase table, claims `pending` jobs, and renders
them with the (authenticated) Higgsfield CLI. It makes only **outbound** calls, so no open ports.

---

## 1. Create the VM (Oracle Cloud console)
1. Sign up / log in at https://cloud.oracle.com (a card is required for identity check; Always Free
   resources cost $0).
2. **Compute → Instances → Create instance.**
   - **Image:** Canonical **Ubuntu 22.04**.
   - **Shape:** Change shape → **Ampere (A1.Flex)** with 1 OCPU / 6 GB *(generous, free)*, **or** if
     A1 says "out of capacity", use **VM.Standard.E2.1.Micro** (AMD, 1 GB — fine for this light
     worker, and not subject to idle reclaim).
   - **SSH keys:** paste your public key. (Make one if needed: `ssh-keygen -t ed25519`, key is in
     `~/.ssh/id_ed25519.pub`.)
   - Create. Note the **public IP**.

## 2. Connect
```bash
ssh ubuntu@<PUBLIC_IP>      # Ubuntu image user is "ubuntu"
```

## 3. Install Python + the Higgsfield CLI binary (no Node needed)
```bash
sudo apt update && sudo apt install -y python3-venv python3-pip rsync

# Grab the official hf binary for this VM's CPU arch, expose it as `higgsfield`:
ARCH=$(uname -m); case "$ARCH" in x86_64) A=amd64;; aarch64) A=arm64;; esac
VER=0.1.40   # match your Mac: `higgsfield --version`
curl -L "https://github.com/higgsfield-ai/cli/releases/download/v${VER}/hf_${VER}_linux_${A}.tar.gz" -o /tmp/hf.tar.gz
tar -xzf /tmp/hf.tar.gz -C /tmp
sudo mv /tmp/hf /usr/local/bin/hf
sudo ln -sf /usr/local/bin/hf /usr/local/bin/higgsfield   # worker calls `higgsfield`
higgsfield --version
```

## 4. Copy the code + env from your Mac
Run this **on your Mac** (not the VM):
```bash
cd /Users/nihalpai/Documents/Lyzr/don-drapor
rsync -av --exclude '.venv' --exclude '__pycache__' --exclude '.next' \
  backend/ ubuntu@<PUBLIC_IP>:~/don-drapor/backend/
```
This includes `backend/.env` (rsync ignores .gitignore), which the worker needs.

## 5. Python deps + auth (back on the VM)
```bash
cd ~/don-drapor/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Authenticate the CLI — device flow prints a URL/code; approve it in YOUR browser.
# (This is a separate session from your Mac; both can stay logged in — same account.)
higgsfield auth login
higgsfield account status        # should show your plan + credits
```

## 6. Smoke test, then run as a service
```bash
# one manual run to confirm it boots (Ctrl+C after you see "video_worker: started"):
.venv/bin/python -m scripts.video_worker

# install as a systemd service (auto-start on boot, auto-restart on crash):
sudo cp ~/don-drapor/backend/scripts/dondrapor-videoworker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now dondrapor-videoworker
journalctl -u dondrapor-videoworker -f     # watch it
```

## Done. Now:
- On **Render**, set `USE_VIDEO_WORKER=true` (enqueue-only). This VM does the rendering.
- You can shut your Mac worker off — this VM is now the renderer, 24/7.

---

## Maintenance / ops
- **Auth expired?** (jobs error or `higgsfield account status` fails) → `ssh` in, run
  `higgsfield auth login` again, then `sudo systemctl restart dondrapor-videoworker`.
- **Pushed code/.env changes?** re-`rsync` (step 4) then `sudo systemctl restart dondrapor-videoworker`.
- **Logs:** `journalctl -u dondrapor-videoworker -f`
- **Oracle idle reclaim:** only A1 (Ampere) instances can be reclaimed when Oracle is
  capacity-constrained AND the VM is idle. The worker's constant polling keeps some activity; if you
  used A1 and it ever gets stopped, just restart it in the console. E2.1.Micro is not reclaimed.
- **Firewall:** none needed — the worker only makes outbound HTTPS. (Don't open any ingress ports.)
