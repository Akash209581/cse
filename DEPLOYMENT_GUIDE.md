# CSE Digital Hub - Server Deployment Guide

Main Access URL: **`http://160.187.169.41/`** (Standard HTTP Port 80, no port number needed)  
Admin Portal URL: **`http://160.187.169.41/csedeptnewadd`**  
Default Admin Passcode: `csedept@2026`  

Backend Internal Port: `4867`  
*(Nginx or Docker routes port 80 to backend port 4867 so visitors do not see any port numbers)*

---

## 1. Copy Files to the Server

From your local machine (PowerShell / Command Prompt or Terminal):

```bash
# Example using SCP to copy the project folder to server
scp -r c:\Users\banda\Desktop\cse username@160.187.169.41:/var/www/cse
```
*(Replace `username` with your server login user, e.g. `root` or `ubuntu`)*

---

## 2. Open Firewall Port 4867

### On Ubuntu/Debian Linux:
```bash
sudo ufw allow 4867/tcp
sudo ufw reload
```

### On CentOS / RHEL / AlmaLinux:
```bash
sudo firewall-cmd --permanent --add-port=4867/tcp
sudo firewall-cmd --reload
```

### On Windows Server (PowerShell as Admin):
```powershell
New-NetFirewallRule -DisplayName "CSE Hub 4867" -Direction Inbound -LocalPort 4867 -Protocol TCP -Action Allow
```

---

## 3. Deployment Method A: PM2 (Recommended)

1. SSH into the server:
   ```bash
   ssh username@160.187.169.41
   cd /var/www/cse
   ```

2. Install dependencies & PM2:
   ```bash
   npm install --production
   sudo npm install -g pm2
   ```

3. Ensure MongoDB is running locally:
   ```bash
   sudo systemctl status mongod
   # If not installed or running:
   sudo systemctl start mongod
   sudo systemctl enable mongod
   ```

4. Start the application with PM2:
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

5. Check status / logs:
   ```bash
   pm2 status
   pm2 logs cse-digital-hub
   ```

---

## 4. Deployment Method B: Docker Compose (All-in-one with MongoDB)

If the server has Docker installed:

```bash
cd /var/www/cse
docker compose up -d --build
```
This automatically sets up MongoDB and runs the server on port `4867`.

To check logs:
```bash
docker compose logs -f
```

---

## 5. Deployment Method C: Linux Systemd Service

1. Copy the service unit file:
   ```bash
   sudo cp cse-digital-hub.service /etc/systemd/system/
   ```

2. Reload and enable:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable cse-digital-hub
   sudo systemctl start cse-digital-hub
   ```

3. Check status:
   ```bash
   sudo systemctl status cse-digital-hub
   ```

---

## 6. Optional: Nginx Reverse Proxy (for port 80 / 443)

If you wish to access the app on standard port 80 or under a custom path/subdomain via Nginx:

```nginx
server {
    listen 80;
    server_name 160.187.169.41;

    location / {
        proxy_pass http://127.0.0.1:4867;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 20M;
    }
}
```
