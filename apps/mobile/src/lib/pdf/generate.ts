import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/** Opens the native print/preview dialog for the given HTML — lets the user print or, on most platforms, save as PDF themselves. */
export async function previewHtml(html: string): Promise<void> {
  await Print.printAsync({ html });
}

/**
 * Renders the HTML to a PDF file and opens the native share sheet. Per
 * docs/billing.md: opening the share sheet is not the same as the bill having
 * reached the customer — callers must not claim it was "sent" from this call
 * alone. See `markBillSent` in src/lib/api/bills.ts for the explicit,
 * admin-confirmed action.
 */
export async function shareHtmlAsPdf(html: string, dialogTitle: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device');
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle });
}
