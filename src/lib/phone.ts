// Phone numbers for WhatsApp links. Numbers are saved as the user types them
// (e.g. "0414-123 4567"); Venezuelan local numbers get the 58 country code.
export function waNumber(phone: string): string {
  let n = phone.replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  if (n.length === 11 && n.startsWith('0')) n = `58${n.slice(1)}`;
  else if (n.length === 10 && n.startsWith('4')) n = `58${n}`;
  return n.length >= 8 ? n : '';
}

export function whatsappUrl(phone: string, text: string): string {
  const n = waNumber(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : '';
}
