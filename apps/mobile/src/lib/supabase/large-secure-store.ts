import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';
import 'react-native-get-random-values';

/**
 * Supabase session blobs can exceed SecureStore's ~2KB per-item limit, so we
 * can't store the session there directly. Instead: encrypt the session with
 * an AES key, keep the (small) key in SecureStore, and the encrypted blob in
 * AsyncStorage. This is the pattern Supabase documents for Expo apps —
 * session credentials never sit in plaintext in AsyncStorage.
 */
/**
 * True only in a real browser/native runtime. False during Node-side
 * server rendering of `expo export --platform web` / `expo start --web`
 * with server output, where there is no window, SecureStore, or persisted
 * session to read — every method below becomes a safe no-op there instead
 * of crashing the server render.
 */
function hasClientRuntime(): boolean {
  return typeof window !== 'undefined';
}

export class LargeSecureStore {
  private async getOrCreateEncryptionKey(storageKeyName: string): Promise<Uint8Array> {
    const keyName = `${storageKeyName}-encryption-key`;
    let encoded = await SecureStore.getItemAsync(keyName);

    if (!encoded) {
      const key = crypto.getRandomValues(new Uint8Array(32));
      encoded = aesjs.utils.hex.fromBytes(key);
      await SecureStore.setItemAsync(keyName, encoded);
    }

    return aesjs.utils.hex.toBytes(encoded);
  }

  async getItem(key: string): Promise<string | null> {
    if (!hasClientRuntime()) {
      return null;
    }

    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) {
      return null;
    }

    const encryptionKey = await this.getOrCreateEncryptionKey(key);
    const [ivHex, cipherHex] = encrypted.split(':');
    if (!ivHex || !cipherHex) {
      return null;
    }

    const aesCbc = new aesjs.ModeOfOperation.cbc(encryptionKey, aesjs.utils.hex.toBytes(ivHex));
    const decryptedBytes = aesCbc.decrypt(aesjs.utils.hex.toBytes(cipherHex));
    const unpadded = aesjs.padding.pkcs7.strip(decryptedBytes);
    return aesjs.utils.utf8.fromBytes(unpadded);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (!hasClientRuntime()) {
      return;
    }

    const encryptionKey = await this.getOrCreateEncryptionKey(key);
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const padded = aesjs.padding.pkcs7.pad(aesjs.utils.utf8.toBytes(value));
    const aesCbc = new aesjs.ModeOfOperation.cbc(encryptionKey, iv);
    const encryptedBytes = aesCbc.encrypt(padded);
    const encrypted = `${aesjs.utils.hex.fromBytes(iv)}:${aesjs.utils.hex.fromBytes(encryptedBytes)}`;
    await AsyncStorage.setItem(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    if (!hasClientRuntime()) {
      return;
    }

    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(`${key}-encryption-key`);
  }
}
