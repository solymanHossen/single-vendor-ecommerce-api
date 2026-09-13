# TLS certificates

Place your certificate chain and private key here before starting the
`docker-compose.prod.yml` overlay:

```
nginx/certs/fullchain.pem
nginx/certs/privkey.pem
```

- **Let's Encrypt (certbot):** copy `fullchain.pem` and `privkey.pem` from
  `/etc/letsencrypt/live/<domain>/` here, and set up renewal to re-copy +
  `docker compose kill -s HUP nginx` on renewal (nginx reloads certs without
  a restart).
- **Internal CA / self-signed (staging only):**
  `openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout privkey.pem -out fullchain.pem`

This directory's contents (other than this file) are git-ignored — never
commit private keys.
