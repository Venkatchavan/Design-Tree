# DesignTree — Internet (WAN) Access on TCP 8443
### Network / firewall / NAT checklist for the client IT team

**Why this document exists.** Ports 80 and 443 on the public IP are already used by
other services, so DesignTree will be published on **TCP 8443** instead.
Users outside the office will open:

```
https://<PUBLIC_IP>:8443
```

Fill in the values below once, then follow the steps in order.

| Item | Value |
|---|---|
| Public IP (static) | `103.169.236.122` *(confirm)* |
| DesignTree server LAN IP | `192.168.1.50` *(confirm — must be a fixed/reserved IP)* |
| Public port (WAN) | **TCP 8443** |
| Server port (LAN) | **TCP 8443** (same number, to keep it simple) |
| Protocol | TCP only (no UDP) |

---

## 0. What IT must do — summary

1. Confirm 8443 is free on the public IP and the ISP does not block it.
2. Give the DesignTree server a fixed LAN IP.
3. Create **one** NAT / port-forward rule: `WAN 8443 → 192.168.1.50:8443`.
4. Create the matching **firewall allow rule** on the perimeter firewall (WAN → server, TCP 8443).
5. Open **TCP 8443 inbound** in Windows Firewall on the server.
6. Test from a network *outside* the office (mobile hotspot).
7. (Optional but recommended) restrict / monitor access.

Nothing else is exposed. **Do not** forward 80, 443 or 4433 from the internet to this server.

---

## 1. Pre-checks (10 minutes)

### 1.1 Is the public IP really ours and static?
- Check the router/firewall WAN interface IP. It must equal the public IP above.
- If the WAN address is in `100.64.0.0/10`, `10.x`, `172.16–31.x` or `192.168.x`,
  the ISP is using **CGNAT** — inbound connections are impossible. Ask the ISP for a
  true public static IP.
- Ask the ISP whether the IP is static. If it changes, the URL stops working.

### 1.2 Is TCP 8443 free?
- On the router/firewall, look at existing port-forward / VIP / virtual-server
  rules. If anything already uses **WAN 8443**, tell us and we will pick another
  port (e.g. 9443, 8444) — the rest of this guide is unchanged apart from the number.
- On the DesignTree server (PowerShell, as admin):
  ```powershell
  netstat -ano | findstr :8443
  ```
  Empty output = free.

### 1.3 Does the ISP block 8443?
Most ISPs do not. If step 6 fails but all rules look right, ask the ISP to confirm
that inbound TCP 8443 is not filtered.

### 1.4 Reserve the server's LAN IP
In the DHCP server/router, create a **DHCP reservation** (or set a static IP) so
`192.168.1.50` never changes. If the server IP changes, the NAT rule breaks.

---

## 2. NAT / port-forward rule (router or perimeter firewall)

Create **one** rule. Names differ by vendor (Port Forwarding, Virtual Server, DNAT, VIP).

| Field | Value |
|---|---|
| Name | `DesignTree-HTTPS-8443` |
| Protocol | TCP |
| Source / "Remote" | Any (or the allow-list from step 7) |
| External / WAN interface | WAN (public IP `103.169.236.122`) |
| External port | **8443** |
| Internal IP | **192.168.1.50** |
| Internal port | **8443** |
| Enabled | Yes |

Notes:
- The destination must be the **DesignTree server only** — not a subnet.
- Do **not** create rules for 80, 443 or 4433.
- Do not enable UPnP-based forwarding for this; use the static rule.

### 2.1 Perimeter firewall policy (if separate from the router)
Add a policy *after* the NAT rule (many firewalls need both a NAT rule and a policy):

| Field | Value |
|---|---|
| From zone | WAN / Internet |
| To zone | LAN (server segment / DMZ) |
| Destination | `192.168.1.50` |
| Service | TCP 8443 |
| Action | Allow |
| Logging | Enable (connection log) |

### 2.2 Hairpin NAT / NAT loopback (office users using the public IP)
Office PCs should keep using `https://192.168.1.50` (LAN). If anyone inside the
office must open `https://103.169.236.122:8443`, the router must support **NAT
loopback / hairpin NAT**; otherwise it will time out from inside. This is a router
limitation, not a DesignTree fault. Using the LAN address internally avoids it.

---

## 3. Windows Firewall on the DesignTree server

Run in an **Administrator** PowerShell on the server:

```powershell
New-NetFirewallRule -DisplayName "DesignTree HTTPS 8443" `
  -Direction Inbound -Protocol TCP -LocalPort 8443 -Action Allow -Profile Any
```

Verify:
```powershell
Get-NetFirewallRule -DisplayName "DesignTree HTTPS 8443" | Get-NetFirewallPortFilter
```

If the network profile is "Public", make sure the rule's `-Profile` includes it
(`-Profile Any` above covers Domain, Private and Public).

> The existing LAN rules for 80/443 can stay as they are for office users.
> Only 8443 is published to the internet.

---

## 4. Server-side change (done by the DesignTree deployment engineer, not IT)

On the server, in `.env`:

```env
HTTPS_PUBLIC_PORT=8443
PUBLIC_IP=103.169.236.122
CLIENT_ORIGIN=https://103.169.236.122:8443,https://192.168.1.50,http://192.168.1.50
```

Then:
```powershell
cd C:\DesignTree
docker compose up -d --build --remove-orphans
docker compose ps
```

Docker publishes host port 8443 and forwards it to the gateway's public HTTPS
listener. `CLIENT_ORIGIN` **must include the `:8443`** origin or login/API calls
from the internet will be rejected by CORS.

**Certbot:** Let's Encrypt can only validate an IP certificate on port 80 (or 443),
and those are taken. Stop the sidecar so it does not retry failed validations every
hour: `docker compose stop certbot`. See section 5 for the certificate consequence.

---

## 5. Certificate (browser padlock) — decision needed

Because 80/443 are not available, **Let's Encrypt cannot issue the public-IP
certificate**. On `https://<PUBLIC_IP>:8443` the server presents the internal
DesignTree certificate (it already lists the public IP), so external browsers will
show **"Not secure / certificate warning"** unless one of these is chosen:

| Option | Effort | Result |
|---|---|---|
| **A. Accept the warning** | none | Works; every external user clicks through "Advanced → Proceed". Acceptable for a pilot only. |
| **B. Install the DesignTree CA on external PCs** | low (`rollout\install-designtree-ca.bat` once per PC) | No warning on those PCs. Good for a known, managed set of users. |
| **C. Get a domain name** (recommended for production) | medium | IT creates a DNS **A record** `designtree.<client-domain>` → public IP; we issue a free, trusted Let's Encrypt certificate using **DNS-01** validation, which works on any port. URL becomes `https://designtree.<client-domain>:8443`, no warning for anyone. Needs a small change on our side. |
| **D. Client's own CA / purchased certificate** | medium | IT supplies a cert + key for a hostname that resolves to the public IP; we install it on the gateway. |

**Please tell us which option.** For anything beyond a pilot we recommend C or D.

---

## 6. Test from OUTSIDE the network (mandatory)

Use a phone on **mobile data / hotspot** or any off-site PC — *not* office Wi-Fi.

1. Port reachable:
   ```powershell
   Test-NetConnection 103.169.236.122 -Port 8443
   ```
   Expect `TcpTestSucceeded : True`.
2. Health endpoint (add `-k` only while using option A):
   ```powershell
   curl.exe -k https://103.169.236.122:8443/api/health
   ```
   Expect `{"ok":true}`.
3. Open `https://103.169.236.122:8443` in a browser, sign in, open a page,
   upload a small file.

| Symptom | Likely cause |
|---|---|
| `TcpTestSucceeded : False` / timeout | NAT rule missing/wrong, perimeter policy missing, ISP block, CGNAT, or Windows Firewall |
| Connects but shows a different site/mail page | Rule points to the wrong internal host/port |
| Certificate warning | Expected with options A/B; see section 5 |
| Page loads but login fails | `CLIENT_ORIGIN` lacks `https://<IP>:8443` (deployment engineer fixes) |
| Works from LAN, not from outside | Rule exists only on one of NAT/policy, or hairpin confusion — test from a mobile hotspot |

---

## 7. Hardening recommended for internet exposure

- **Source allow-list:** if remote users come from known IPs/ranges, restrict the
  NAT/policy source to them instead of "Any".
- **Only 8443 open** to this server; deny everything else WAN → server.
- **Connection logging** on the 8443 policy; review periodically.
- **IPS / geo-IP filtering** on the perimeter firewall if available.
- The application already rate-limits login attempts and blocks the database admin
  path; the database (27017) and API (5000) are **not** exposed and must never be forwarded.
- Keep the Windows server patched; keep Docker Desktop updated.
- If a VPN is available, a VPN-only access model is safer than public exposure —
  tell us if you prefer that.

---

## 8. Rollback

Disable the `DesignTree-HTTPS-8443` NAT rule and policy. External access stops
immediately; LAN access (`https://192.168.1.50`) is unaffected.

---

## 9. What we need back from IT

- [ ] Public IP confirmed static (and not CGNAT)
- [ ] 8443 confirmed free (or alternate port chosen: ______ )
- [ ] Server LAN IP reserved: ____________
- [ ] NAT rule created (WAN 8443 → server 8443)
- [ ] Perimeter firewall policy created
- [ ] Windows Firewall rule created
- [ ] Certificate option chosen (A / B / C / D) and, if C/D, DNS name or certificate supplied
- [ ] External test passed from mobile hotspot (screenshot of `Test-NetConnection`)
