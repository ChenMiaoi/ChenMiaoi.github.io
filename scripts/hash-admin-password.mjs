import { randomBytes, scryptSync } from "node:crypto";
const password = process.argv[2];
if (!password || password.length < 12) { console.error("Usage: node scripts/hash-admin-password.mjs '<password>' (minimum 12 characters)"); process.exit(1); }
const cost = 16384; const salt = randomBytes(16); const hash = scryptSync(password, salt, 64, { N: cost });
console.log(`scrypt$${cost}$${salt.toString("hex")}$${hash.toString("hex")}`);
