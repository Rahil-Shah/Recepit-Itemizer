// Vercel entry point.
//
// The whole Express app runs as one serverless function: vercel.json rewrites
// every /api/* request here and serves public/ straight from the CDN, so this
// function never sees a request for a page or a stylesheet. server.mjs only
// listens on a port when it is run directly, which it is not here.
export { default } from "../server.mjs";
