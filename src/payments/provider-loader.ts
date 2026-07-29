// This intentionally creates a reviewable dynamic-import mapping unknown.
export async function loadPaymentProvider(providerModule: string) {
  return import(providerModule);
}
