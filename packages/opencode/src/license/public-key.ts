// Production Ed25519 verification keys (SPKI DER, base64). Signing keys never live in this repository.
// Rotate by adding a new kid, releasing, then removing retired kids in a later release.
export const publicKeys: readonly { kid: string; spki: string }[] = [
  { kid: "5e8098b097d0", spki: "MCowBQYDK2VwAyEAaSy6V58WpHK2JEDC7Q7xzJd5oqwF0311+H2JQ9QkddY=" },
]
