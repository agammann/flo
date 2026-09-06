import { browserRequest } from './browser-request.js';
const conversation = document.querySelector('#conversation');
const details = document.querySelector('#details');
let lastResponse = '';
let activeRequest;
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100);
function message(text, kind = 'answer') {
  const p = document.createElement('p'); p.className = kind; p.textContent = text; conversation.append(p); conversation.scrollTop = conversation.scrollHeight; return p;
}
function row(label, value, total = false) {
  const item = document.createElement('div'); item.className = total ? 'detail-row total' : 'detail-row';
  const title = document.createElement('span'); title.textContent = label;
  const content = document.createElement('strong'); content.textContent = value;
  item.append(title, content); details.append(item);
}
function render(data) {
  details.replaceChildren();
  if (!data) { const p = document.createElement('p'); p.textContent = 'No updated repair details for this response.'; details.append(p); return; }
  if (Array.isArray(data)) { for (const repair of data) { row(`Repair ${repair.repairNumber}`, repair.vehicle); row('Status', repair.status.replaceAll('_', ' ')); } return; }
  row('Repair', data.repairNumber);
  if ('vehicle' in data) {
    row('Vehicle', data.vehicle); row('Status', data.status.replaceAll('_', ' '));
    row('Scheduled service', data.scheduledStart ? new Date(data.scheduledStart).toLocaleString('en-US', {timeZone:'UTC'}) + ' UTC' : 'Not scheduled');
    if (data.scheduledEnd) row('Scheduled end', new Date(data.scheduledEnd).toLocaleString('en-US', {timeZone:'UTC'}) + ' UTC');
  } else {
    for (const part of data.parts) row(`${part.quantity} × ${part.description}`, money(part.totalCents));
    for (const labor of data.labor) row(labor.description, money(labor.totalCents));
    row('Fees (included in subtotal)', money(data.feesCents)); row('Subtotal including fees', money(data.subtotalCents));
    row('Tax', money(data.taxCents)); row('Discount', money(data.discountCents)); row('Total', money(data.totalCents), true);
    row('Approval status', data.approvalStatus.replaceAll('_', ' '));
  }
}
async function ask(command) {
  if (!document.querySelector('#consent').checked) { message('Please read and acknowledge the preview notice first.'); return; }
  if (!command.trim()) { message('Ask for your repairs, repair status, or an estimate.'); return; }
  if (activeRequest) return;
  message(command, 'question'); const pending = message('Checking your repair information…');
  const controller = new AbortController(); activeRequest = controller;
  const timer = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await browserRequest('/api/customer/command', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({command, demoConsent:true}), signal:controller.signal });
    const result = await response.json();
    if (activeRequest !== controller) return;
    lastResponse = result.voice; message(lastResponse); render(result.data);
    document.querySelector('#trace').textContent = (result.tools || []).join(' → ') || 'No tools called.';
  } catch {
    if (activeRequest === controller) message('The service did not respond. Please try again shortly.');
  } finally { pending.remove(); window.clearTimeout(timer); if (activeRequest === controller) activeRequest = undefined; }
}
document.querySelector('#question-form').addEventListener('submit', event => { event.preventDefault(); const input = document.querySelector('#question'); void ask(input.value); input.value = ''; });
document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', () => { void ask(button.dataset.command); }));
document.querySelector('#start-over').addEventListener('click', () => {
  activeRequest?.abort(); activeRequest = undefined; lastResponse = ''; window.speechSynthesis?.cancel(); conversation.replaceChildren(); details.replaceChildren(); document.querySelector('#question').value = ''; document.querySelector('#trace').textContent = 'No tools called.'; message('Started over. No repair records were changed. Ask for your repairs when ready.');
});
document.querySelector('#listen').addEventListener('click', () => {
  if (!lastResponse) return;
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { message('Read-aloud is unavailable in this browser. The full response is in the conversation.'); return; }
  window.speechSynthesis.cancel(); const speech = new window.SpeechSynthesisUtterance(lastResponse); speech.lang = 'en-US'; window.speechSynthesis.speak(speech);
});
