"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchRssXml = fetchRssXml;
const node_http_1 = __importDefault(require("node:http"));
const node_https_1 = __importDefault(require("node:https"));
const node_url_1 = require("node:url");
async function fetchRssXml(url) {
    const u = new node_url_1.URL(url);
    const client = u.protocol === 'https:' ? node_https_1.default : node_http_1.default;
    return await new Promise((resolve, reject) => {
        const req = client.request({
            method: 'GET',
            hostname: u.hostname,
            port: u.port,
            path: `${u.pathname}${u.search}`,
            headers: {
                'User-Agent': 'e-cu-rss-adapter',
                Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
            },
        }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf-8');
                if (res.statusCode !== 200) {
                    reject(new Error(`Failed to fetch RSS XML. status=${res.statusCode}`));
                    return;
                }
                resolve(body);
            });
        });
        req.on('error', reject);
        req.end();
    });
}
