# Shared reverse-proxy settings, included from every location block that
# proxies to the Nest app. Not a *.conf file on purpose — nginx.conf's
# `include conf.d/*.conf` would otherwise try to load it as a top-level
# server block, which is invalid outside a `location {}` context.
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header Connection "";

proxy_connect_timeout 5s;
proxy_send_timeout    30s;
proxy_read_timeout    30s;

proxy_next_upstream error timeout http_502 http_503 http_504;
proxy_next_upstream_tries 2;
