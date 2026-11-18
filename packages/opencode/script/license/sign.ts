// Internal license signing. Never imported by product code; never shipped in exe/vsix.
import { createHash, createPrivateKey, generateKeyPairSync, sign } from "crypto"
import { localDate, normalizeMachineID, prefix, type Payload } from "../../src/license/license"

export function generateKeyPair() {
  const pair = generateKeyPairSync("ed25519")
  const spki = pair.publicKey.export({ format: "der", type: "spki" }).toString("base64")
  return {
    privateKeyPem: pair.privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
    spki,
    kid: keyID(spki),
  }
}

export function keyID(spki: string) {
  return createHash("sha256").update(spki).digest("hex").slice(0, 12)
}

export function signLicense(
  privateKeyPem: string,
  input: { kid: string; machineID: string; exp?: string; sub?: string; now?: Date },
) {
  const mid = normalizeMachineID(input.machineID)
  if (!mid) throw new Error(`Invalid machine ID: ${input.machineID}`)
  if (input.exp && !/^\d{4}-\d{2}-\d{2}$/.test(input.exp)) throw new Error(`Invalid expiry date: ${input.exp}`)
  const payload: Payload = {
    v: 2,
    kid: input.kid,
    mid,
    iat: localDate(input.now ?? new Date()),
    ...(input.exp ? { exp: input.exp } : {}),
    ...(input.sub ? { sub: input.sub } : {}),
  }
  const head = `${prefix}.${Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")}`
  const signature = sign(null, Buffer.from(head, "ascii"), createPrivateKey(privateKeyPem)).toString("base64url")
  return `${head}.${signature}`
}
