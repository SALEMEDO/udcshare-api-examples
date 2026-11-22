import { httpServerHandler } from "cloudflare:node";
import app from "./server.js";

// Express 5 remains the API router. Cloudflare bridges its Node HTTP server
// to the Workers request lifecycle; no TCP listener is exposed publicly.
app.listen(8787);

export default httpServerHandler({ port: 8787 });
