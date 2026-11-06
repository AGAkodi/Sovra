import nacl from 'tweetnacl';

export interface AttestationPayload {
  vault_contract_id: string;
  request_id: string;
  recipient: string;
  amount_yocto: string;
  risk_score: number;
  authority_level: number;
  expiry_ns: string;
}

export interface SignedAttestation {
  payload: AttestationPayload;
  signature_hex: string;
  signer_public_key: string; // ed25519:<hex or bs58>
}

// Minimal Base58 encoder for NEAR Public Keys
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

export class AttestationSigner {
  private keyPair: nacl.SignKeyPair;

  constructor(secretKeySeed?: Uint8Array) {
    if (secretKeySeed && secretKeySeed.length === 32) {
      this.keyPair = nacl.sign.keyPair.fromSeed(secretKeySeed);
    } else {
      this.keyPair = nacl.sign.keyPair();
    }
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

  public static createMessage(payload: AttestationPayload): Uint8Array {
    const raw = `${payload.vault_contract_id}:${payload.request_id}:${payload.recipient}:${payload.amount_yocto}:${payload.risk_score}:${payload.authority_level}:${payload.expiry_ns}`;
    return Buffer.from(raw, 'utf-8');
  }

  public signAttestation(payload: AttestationPayload): SignedAttestation {
    const message = AttestationSigner.createMessage(payload);
    const signature = nacl.sign.detached(message, this.keyPair.secretKey);
    return {
      payload,
      signature_hex: Buffer.from(signature).toString('hex'),
      signer_public_key: this.getNearPublicKey(),
    };
  }

  public static verifyAttestation(
    payload: AttestationPayload,
    signatureHex: string,
    publicKey: Uint8Array
  ): boolean {
    const message = AttestationSigner.createMessage(payload);
    const signature = Buffer.from(signatureHex, 'hex');
    return nacl.sign.detached.verify(message, signature, publicKey);
  }
}

