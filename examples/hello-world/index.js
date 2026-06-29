// The smallest possible saloon-js program: one connector, one request, one send.
// No auth, no body — a GET that returns plain text.
//
//   pnpm install && pnpm start

import { defineConnector, defineRequest, Method, send } from 'saloon-js';

const gitHub = defineConnector({ baseUrl: 'https://api.github.com' });
const getZen = defineRequest({ method: Method.GET, endpoint: '/zen' });

const response = await send(gitHub, getZen);

console.log(`HTTP ${response.status()}`);
console.log(response.body());
