// `handle_new_user` names a new account after its email ("ana.marin" for
// ana.marin@gmail.com); that, or nothing, is not a name anyone chose.
export function isPlaceholderName(displayName, email) {
  const name = String(displayName || '').trim();
  if (!name) return true;
  const local = String(email || '').split('@')[0].trim();
  return !!local && name.toLowerCase() === local.toLowerCase();
}
