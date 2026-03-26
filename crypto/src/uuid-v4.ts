import { randomUUID } from 'node:crypto';

import { showToast, Clipboard } from '@vicinae/api';

export default async function UUIDV4() {
  const uuid = randomUUID();
  Clipboard.copy(uuid);
  await showToast({ title: 'Copied UUID to clipboard' });
}
