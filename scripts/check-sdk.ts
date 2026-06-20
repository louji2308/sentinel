import { getNodeUrl, NODE_URLS, getEnvironment, setEnvironment } from "@terminal3/t3n-sdk";

console.log("NODE_URLS:", JSON.stringify(NODE_URLS));
console.log("getNodeUrl():", getNodeUrl());
console.log("getEnvironment():", JSON.stringify(getEnvironment()));

setEnvironment("testnet");
console.log("After setEnvironment testnet:");
console.log("  getNodeUrl():", getNodeUrl());
console.log("  getEnvironment():", JSON.stringify(getEnvironment()));
