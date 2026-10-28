import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function shareCsv(filename: string, csv: string): Promise<void> {
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  await file.write(csv);

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device');
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: filename });
}
