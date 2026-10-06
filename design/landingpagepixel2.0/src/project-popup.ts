let opener: HTMLElement | null = null;
document.addEventListener('click', event => {
  if (!(event.target instanceof Element) || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const trigger = event.target.closest<HTMLElement>('[data-project-popup]');
  if (!trigger || trigger.closest('x-dc')) return;
  const dialog = document.getElementById(`project-popup-${trigger.dataset.projectPopup}`);
  if (!(dialog instanceof HTMLDialogElement) || typeof dialog.showModal !== 'function') return;
  event.preventDefault();
  opener = trigger;
  dialog.showModal();
});
document.querySelectorAll<HTMLDialogElement>('.project-modal').forEach(dialog => {
  dialog.addEventListener('close', () => opener?.focus());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
});
export {};
