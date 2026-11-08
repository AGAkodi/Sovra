import nacl from 'tweetnacl';

/**
 * Domain separator for signed attestations.
 * Must match ATTESTATION_DOMAIN / attestation_message() in contracts/throttle-vault/src/lib.rs.
 */
export const ATTESTATION_DOMAIN = 'throttle-attestation-v1';

export interface AttestationPayload {
  chain_id: string; // e.g. "testnet"
  vault_contract_id: string;
  request_id: string;
  recipient: string;
  amount_yocto: string;
  risk_score: number;
  authority_level: number;
  policy_version: number;
  expiry_ns: string;
}

export interface SignedAttestation {
  payload: AttestationPayload;
  signature_hex: string;
  signer_public_key: string; // ed25519:<base58>
}

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function toBase58(buffer: Uint8Array): string {
  const digits: number[] = [0];
  for (let i = 0; i < buffer.length; i++) {
    for (let j = 0; j < digits.length; j++) digits[j] <<= 8;
    digits[0] += buffer[i];
    let carry = 0;
    for (let j = 0; j < digits.length; j++) {
      digits[j] += carry;
      carry = (digits[j] / 58) | 0;
      digits[j] %= 58;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) digits.push(0);
  return digits.reverse().map((digit) => BASE58_ALPHABET[digit]).join('');
}

export function fromBase58(str: string): Uint8Array {
  const bytes: number[] = [0];
  for (const char of str) {
    const value = BASE58_ALPHABET.indexOf(char);
    if (value < 0) throw new Error(`Invalid base58 character '${char}'`);
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; i < str.length && str[i] === '1'; i++) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
}

/**
 * Parses a NEAR-format ed25519 secret key ("ed25519:<base58>"), as produced by
 * near-cli-rs or scripts/keygen.ts. Accepts a 64-byte secret key or a 32-byte seed.
 */
export function parseNearSecretKey(key: string): nacl.SignKeyPair {
  const [curve, data] = key.includes(':') ? key.split(':', 2) : ['ed25519', key];
  if (curve !== 'ed25519') throw new Error(`Policy signer must be ed25519, got '${curve}'`);
  const raw = fromBase58(data);
  if (raw.length === 64) return nacl.sign.keyPair.fromSecretKey(raw);
  if (raw.length === 32) return nacl.sign.keyPair.fromSeed(raw);
  throw new Error(`Invalid ed25519 secret key length ${raw.length}`);
}

export class AttestationSigner {
  private keyPair: nacl.SignKeyPair;
  public readonly isEphemeral: boolean;

  constructor(keyPair?: nacl.SignKeyPair) {
    this.isEphemeral = !keyPair;
    this.keyPair = keyPair ?? nacl.sign.keyPair();
  }

  public static fromSeed(seed: Uint8Array): AttestationSigner {
    return new AttestationSigner(nacl.sign.keyPair.fromSeed(seed));
  }

  /**
   * Loads POLICY_SIGNER_PRIVATE_KEY. When `required` is true (real testnet mode) a
   * missing key is fatal: an ephemeral key would never match the on-chain signer.
   */
  public static fromEnv(required: boolean): AttestationSigner {
    const key = process.env.POLICY_SIGNER_PRIVATE_KEY?.trim();
    if (key && !key.endsWith('...')) {
      return new AttestationSigner(parseNearSecretKey(key));
    }
    if (required) {
      throw new Error('POLICY_SIGNER_PRIVATE_KEY is required in testnet mode (run scripts/keygen.ts).');
    }
    return new AttestationSigner();
  }

  public getPublicKey(): Uint8Array {
    return this.keyPair.publicKey;
  }

  public getNearPublicKey(): string {
    return `ed25519:${toBase58(this.keyPair.publicKey)}`;
  }

  public getPublicKeyHex(): string {
    return Buffer.from(this.keyPair.publicKey).toString('hex');
  }

  public static createMessageString(p: AttestationPayload): string {
    return [
      ATTESTATION_DOMAIN,
      p.chain_id,
      p.vault_contract_id,
      p.request_id,
      p.recipient,
      p.amount_yocto,
      p.risk_score,
      p.authority_level,
      p.policy_version,
      p.expiry_ns,
    ].join('|');
  }

  public static createMessage(payload: AttestationPayload): Uint8Array {
    return Buffer.from(AttestationSigner.createMessageString(payload), 'utf-8');
  }

  public signAttestation(payload: AttestationPayload): SignedAttestation {
    const signature = nacl.sign.detached(AttestationSigner.createMessage(payload), this.keyPair.secretKey);
    return {
      payload,
      signature_hex: Buffer.from(signature).toString('hex'),
      signer_public_key: this.getNearPublicKey(),
    };
  }

  public static verifyAttestation(payload: AttestationPayload, signatureHex: string, publicKey: Uint8Array): boolean {
    const signature = Buffer.from(signatureHex, 'hex');
    return nacl.sign.detached.verify(AttestationSigner.createMessage(payload), signature, publicKey);
  }
}
