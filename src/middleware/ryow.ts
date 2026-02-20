import { createMiddleware } from "hono/factory";

const RYOW_WINDOW_MS = 20000; // intentionally high value to allow for manual tests.

export const ryow = createMiddleware<{
	Variables: { forcePrimary: boolean };
}>(async (c, next) => {
	const token = c.req.header("x-write-token");
	if (token) {
		const ts = Number(token);
		if (!Number.isNaN(ts) && Date.now() - ts < RYOW_WINDOW_MS) {
			c.set("forcePrimary", true);
		}
	}
	await next();
});
