# Deployment

The server layout is release based:

```text
/opt/ci/
  current -> releases/<git-sha>
  deploy/compose.yaml
  deploy/nginx.conf
  releases/<git-sha>/out/
```

Build and validate the static export before uploading a release:

```bash
npm ci
npm run check
npm run build
npm run validate:site
```

After extracting `out/` into a new release, atomically update `current`, then recreate the container from `/opt/ci/deploy`:

```bash
ln -s "releases/<git-sha>" /opt/ci/.current-new
mv -Tf /opt/ci/.current-new /opt/ci/current
docker compose up -d --force-recreate
curl --fail --silent --show-error http://127.0.0.1:3508/healthz
```

The forced recreation is required because Docker resolves the `current/out` bind mount when it creates the container. Rollback uses the same two symlink commands with the previous release SHA, followed by the same recreate and health check. Port `3508` stays bound to loopback for the existing reverse proxy; do not open it in UFW or the cloud firewall.
