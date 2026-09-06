// One bootstrap per page; never retry a mutation automatically.
let session;
export async function browserRequest(path, options = {}) {
  if (!session) session = fetch('/api/browser-session', { cache: 'no-store', credentials: 'same-origin' }).then(async response => {
    if (!response.ok) throw new Error('Open the local Flo simulator and reload.');
    return response.json();
  }).catch(error => { session = undefined; throw error; });
  const { csrfToken } = await session;
  return fetch(path, { ...options, credentials: 'same-origin', headers: { ...options.headers, 'X-Flo-CSRF': csrfToken } });
}
