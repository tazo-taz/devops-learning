# HTTP, proxies and encryption, explained simply

Background for Step 5 (local domain + HTTPS). Read it top to bottom: each part builds on the one before.
(Written 2026-11-17.)

---

## 1. HTTP: a question and an answer, in plain text

When you run `curl http://10.97.0.133/api/users`, your PC opens a connection to the server and sends text:

```
GET /api/users HTTP/1.1          <- the request: "give me /api/users"
Host: 10.97.0.133
```

The server answers with text:

```
HTTP/1.1 200 OK                  <- the status code (200, 404, 502 ...)
Content-Type: application/json

[{"id":1,"name":"tazo"}]         <- the body
```

That is all HTTP is: **request → response, as readable text**.

**The problem:** the text travels through many machines (your Wi-Fi router, the office network, internet providers). Every one of them can **read** it and **change** it. A password sent over plain HTTP is a postcard, not a sealed letter.

---

## 2. Proxy: a middleman that passes requests on

A proxy is a program that stands **between** the client and the server. The client talks to the proxy, the proxy talks to the server, and passes the answer back.

There are two kinds. They are the same idea, but they stand on opposite sides and work for different people.

### Forward proxy: stands in front of the CLIENTS (the corporate proxy)

```
your PC ──► proxy.mia.gov.ge:3128 ──► internet (github.com, npmjs.org, ghcr.io ...)
```

- It works for **the office**. PCs in the office cannot reach the internet directly, only through it.
- Why offices use one: control (block sites), logging (who visited what), scanning for viruses.
- The client must **know** about it. That is what these variables do: `http_proxy`, `https_proxy` = "send my requests to this address instead of straight to the site". `no_proxy` = "but NOT for these addresses, go direct".

### Reverse proxy: stands in front of the SERVERS (our nginx)

```
visitor ──► nginx :80 ──┬─► web:80       (location /)
                        └─► api:3000     (location /api/)
```

- It works for **us, the site owner**. The visitor does not know it exists. They think nginx IS the site.
- Why we use one: one door (port 80/443) for many services, the api and database stay hidden on the Docker network, and it is the single place to put HTTPS.
- This is the `proxy_pass` line in `nginx/default.conf`.

| | Forward proxy | Reverse proxy |
|---|---|---|
| In our project | `proxy.mia.gov.ge:3128` | our `nginx` container |
| Stands in front of | clients (office PCs) | servers (web, api) |
| Who set it up | the office IT | us |
| Client knows about it? | yes (`http_proxy`) | no |

---

## 3. What the corporate proxy has done to our project so far

Every problem below is the same root cause: **a program tried to reach the internet and did not go through the proxy, or did not trust it.**

| Where | What happened | Why |
|---|---|---|
| `docker build` (`npm install`), projects 2–7 | certificate error | the proxy opens HTTPS traffic (see part 6), npm did not trust it → we pass the MIA CA as a build secret |
| `apt` in the VM | no downloads | apt has its own proxy file (`95proxy`) |
| Docker in the VM (Step 3 break-it) | `proxyconnect ... :3129 connection refused` | the Docker **daemon** has its own proxy setting in `/etc/docker/daemon.json` |
| `snap` on your PC | store unreachable | snapd needs `snap set system proxy...` |
| `curl http://10.97.0.133` from Claude's shell (today) | hangs, timeout | the request went to the proxy, and the office proxy cannot reach a VM that lives inside your PC |

Two lessons:

1. **Each program has its own proxy setting.** The shell variables only help programs that read them (curl, git, npm). Services like the Docker daemon, apt and snapd need their own config.
2. **Local addresses must skip the proxy.** The VM (`10.97.0.133`) and soon `devops.test` are on your PC. The proxy sits in the office network and cannot see them. So they need `no_proxy`, or `curl --noproxy '*'`.

> Seen today: your `no_proxy` contains `10.0.0/8`. It was probably meant to be `10.0.0.0/8` (all 10.x.x.x addresses). As written, curl does not match the VM's address, so it sends the request to the proxy.

---

## 4. Encryption: scrambling the text so only the other side can read it

Encryption turns readable text into noise using a **key**. Without the right key, the noise cannot be turned back.

You already use this. SSH in Step 1:

- A **key pair**: a **private** key (stays with the owner, never leaves) and a **public** key (may be given to anyone).
- What one of them locks, only the other one opens.
- So: anyone can lock a message with your public key, and only you can open it. And if you can open it, you have **proven** you hold the private key.

HTTPS uses the same trick.

---

## 5. HTTPS = the same HTTP, inside an encrypted tunnel (TLS)

The HTTP text from part 1 does not change. It is simply sent inside a tunnel called **TLS**. Port 443 instead of 80.

TLS does **two separate jobs**. Keep them apart in your head, this is the key to Step 5:

### Job 1: Encrypt ("nobody in the middle can read this")

At the start, client and server agree on a secret key for this one connection, using the server's key pair. From then on everything is noise to anyone in between. For this job, the server only needs **a** key pair. Any key pair.

### Job 2: Identify ("am I really talking to devops.test?")

Encryption alone is not enough. If an attacker sits in the middle and offers **their own** key pair, you get a perfectly encrypted tunnel... to the attacker.

So the server also shows a **certificate**. A certificate is a small file that says:

```
This public key belongs to:   devops.test
Valid until:                  2027-11-17
Signed by:                    <a Certificate Authority>
```

- A **CA** (Certificate Authority) is an organisation that checks "do you really own this name?" and then **signs** the certificate with the CA's own private key.
- Your PC has a list of CAs it trusts (the **trust store**, `/etc/ssl/certs`). Browsers and curl check: "is this certificate signed by a CA on my list, and is the name the one I asked for?"
- Signed by a trusted CA + right name → the lock icon. Otherwise → a certificate error, and curl stops.

The certificate is **public**. The matching **private key** stays on the server and is the real secret (it never goes in git).

```
   Job 1 (encrypt)          needs: the server's key pair
   Job 2 (identify)         needs: a certificate for that key, signed by a CA your PC trusts
```

`curl -k` means: "skip the check of Job 2". Think about what that does and does not switch off.

---

## 6. How the corporate proxy can read HTTPS (and why we needed the MIA CA)

If HTTPS is a sealed tunnel from your PC to `npmjs.org`, how does the office proxy scan it? It **stands in the middle on purpose**:

```
your PC ══tunnel 1══► proxy ══tunnel 2══► npmjs.org
        cert: "npmjs.org",                 the real cert
        signed by MIA-ROOT-CA
```

- The proxy makes its **own** certificate for `npmjs.org` on the fly and signs it with the office's CA, **MIA-ROOT-CA**.
- Your PC has MIA-ROOT-CA in its trust store (IT installed it), so Job 2 passes and you see no error.
- A fresh Docker container does **not** have MIA-ROOT-CA → Job 2 fails → `npm install` certificate error. That is why we give the build the CA file: not to avoid the proxy, but to **trust** it (R56).

This is called a **TLS-inspecting proxy**. It is exactly the attack from part 5, done openly by the owner of the network.

---

## 7. What Step 5 does with all this

We do the same thing the office did, in small:

1. **A name**: `/etc/hosts` line `10.97.0.133 devops.test` (a certificate is made for a name, not for an IP we type by hand).
2. **Our own CA**: one key pair + a CA certificate, made with `openssl`. This plays the role of MIA-ROOT-CA / Let's Encrypt.
3. **A certificate for `devops.test`**, signed by our CA. Cert + private key are mounted into nginx.
4. **nginx**: `listen 443 ssl` with the cert and key; port 80 only redirects to `https://`.
5. **Trust**: add our CA to the trust store of your PC, so Job 2 passes.
6. **Firewall + proxy**: `ufw allow 443`, and `devops.test` must skip the corporate proxy.

```
your PC ══TLS══► nginx :443 (cert for devops.test) ──plain HTTP──► web / api
                 └─ HTTPS ends here ("TLS termination")
```

Inside the Docker network, nginx still talks plain HTTP to `web` and `api`. That is normal: that network is private, only nginx is open to the outside.

On the real VPS (Step 10), only point 2 changes: Let's Encrypt signs the certificate, and every PC in the world already trusts Let's Encrypt.
