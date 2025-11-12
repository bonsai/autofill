const statusEl = document.getElementById('status');
const selectEl = document.getElementById('profileSelect');

function setStatus(s){ statusEl.textContent = s; }

function refreshProfiles(){
  chrome.runtime.sendMessage({ type:'GET_PROFILES' }, (res) => {
    if (!res || !res.ok) { setStatus('Failed to load profiles'); return; }
    selectEl.innerHTML = '';
    for (const p of res.profiles){
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = `${p.name || p.id}`;
      if (p.id === res.activeProfileId) opt.selected = true;
      selectEl.appendChild(opt);
    }
    setStatus(`Loaded ${res.profiles.length} profiles`);
  });
}

selectEl.addEventListener('change', () => {
  chrome.runtime.sendMessage({ type:'SET_ACTIVE_PROFILE', profileId: selectEl.value }, (res) => {
    setStatus(res && res.ok ? 'Active profile set' : 'Failed to set active profile');
  });
});

const fileInput = document.getElementById('fileInput');

document.getElementById('importBtn').addEventListener('click', async () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) { setStatus('Select me.json first'); return; }
  const text = await file.text();
  chrome.runtime.sendMessage({ type:'LOAD_DATA', payload: text }, (res) => {
    if (res && res.ok) { setStatus('Imported'); refreshProfiles(); }
    else { setStatus('Import failed: ' + (res && res.error || 'unknown')); }
  });
});

document.getElementById('exportBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type:'EXPORT_DATA' }, (res) => {
    if (!res || !res.ok) { setStatus('Export failed'); return; }
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'me.json';
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Exported');
  });
});

refreshProfiles();
