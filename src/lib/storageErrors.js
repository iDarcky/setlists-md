// IndexedDB refuses a write when the device is out of space. Browsers name it
// differently (QuotaExceededError, legacy code 22, Firefox's
// NS_ERROR_DOM_QUOTA_REACHED); all of them say "quota" somewhere.
export function isQuotaError(err) {
  if (!err) return false;
  return err.name === 'QuotaExceededError' || err.code === 22 || /quota/i.test(String(err.message || err.name || ''));
}
