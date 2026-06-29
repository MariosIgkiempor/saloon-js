// Preserves PHP `empty()` semantics for string bodies (porting discipline).
//
// PHP's `empty()` treats `''`, `'0'`, `null` and `undefined` as empty — the `'0'`
// case is the notorious quirk SaloonPHP inherits, so `stringBody('0')` is empty.

export function isEmptyString(value: string | null | undefined): boolean {
  return value === undefined || value === null || value === '' || value === '0';
}
