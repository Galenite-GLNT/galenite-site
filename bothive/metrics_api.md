# Metrics API and API Key Setup

This project exposes `/internal/metrics` (served by `services/api.py`) for viewing bot statistics. Authentication is enforced with API keys so each deployed bot instance can have its own credentials.

## Configure API keys

Set **one** of the following environment variables before starting the bot:

- `API_KEYS`: comma-separated list mapping project names to keys in the format `project1:key1,project2:key2`. Whitespace is allowed around entries.
- `API_KEY`: single key for the default project (used only if `API_KEYS` is not provided).

Notes:
- If no keys are set, the metrics endpoint stays open (not recommended for production).
- If an entry omits the project name (e.g., `key123`), the project defaults to `default`.

### Examples

- Single project with explicit name:
  ```bash
  export API_KEYS="mybot:super-secret-key"
  ```
- Multiple projects sharing the same deployment:
  ```bash
  export API_KEYS="prod:prod-key, staging:staging-key, demo:demo-key"
  ```
- Simple single-key setup:
  ```bash
  export API_KEY="super-secret-key"
  ```

## Query metrics

Send the API key either as a header or query parameter:

```bash
curl -H "X-API-Key: super-secret-key" https://<host>:<port>/internal/metrics
# or
curl "https://<host>:<port>/internal/metrics?api_key=super-secret-key"
```

The response includes the resolved project label and current metrics snapshot:

```json
{
  "project": "mybot",
  "metrics": { ... }
}
```

## Guidance for building a web page that connects via API key

If you are creating a management page to attach bots by API key and stream their stats, consider the following approach:

1. **Store keys per account**: When a user adds a bot, persist the API key and optional project label in their account record. Use a secure storage mechanism (e.g., encrypted column or secrets vault) and never log the raw key.
2. **Key validation**: On save, issue a test request to `/internal/metrics` with the provided key. Reject or warn if the endpoint returns `401` or times out.
3. **Listing bots**: Render the saved bots in a list showing the project label returned by the metrics API. Refresh the label if the user edits the key.
4. **Live statistics**:
   - **Polling**: Fetch `/internal/metrics` every 10–30 seconds with the stored key. Show loading/error states for failed requests.
   - **Streaming option**: If you add a proxy in your app, you can upgrade to server-sent events or WebSockets later; start with polling because the current API returns JSON snapshots.
5. **Server-side proxy (recommended)**: Call the metrics endpoint from your backend to keep API keys off the client. Cache responses briefly (e.g., 5–10 seconds) to reduce load.
6. **Revocation**: Provide a delete action that removes the stored key and stops polling. If a request starts returning `401`, mark the entry as invalid and prompt the user to update the key.
7. **Observability**: Log only high-level request results (success/latency/status) without storing the key. Alert on repeated `401` or connection failures per bot.

Use these steps as a blueprint when coordinating with another assistant to implement the web UI.
