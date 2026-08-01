export const ACTIONS_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Content-Encoding, Accept-Encoding",
  // Signals Blink-aware clients (Dialect, wallet in-app browsers, ...) that
  // this endpoint speaks the Solana Actions spec.
  "X-Action-Version": "2.4",
};

export function actionsJson(body: unknown, init?: ResponseInit) {
  return Response.json(body, {
    ...init,
    headers: { ...ACTIONS_CORS_HEADERS, ...(init?.headers ?? {}) },
  });
}

export function actionsOptions() {
  return new Response(null, { status: 204, headers: ACTIONS_CORS_HEADERS });
}

export function actionsError(message: string, status = 400) {
  return actionsJson({ message }, { status });
}
