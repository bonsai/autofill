// Storage schema: { activeProfileId: string, profiles: [{id,name,data:{...}}] }
const STORAGE_KEY = 'autofill_data';

async function getData() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      resolve(res[STORAGE_KEY] || { activeProfileId: null, profiles: [] });
    });
  });
}

async function setData(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: data }, () => resolve());
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const data = await getData();
    switch (msg.type) {
      case 'LOAD_DATA': {
        try {
          const incoming = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
          if (!incoming || !Array.isArray(incoming.profiles)) throw new Error('Invalid me.json: profiles missing');
          const merged = { activeProfileId: incoming.activeProfileId || (incoming.profiles[0]?.id || null), profiles: incoming.profiles };
          await setData(merged);
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
        break;
      }
      case 'EXPORT_DATA': {
        sendResponse({ ok: true, data });
        break;
      }
      case 'GET_PROFILES': {
        sendResponse({ ok: true, profiles: data.profiles, activeProfileId: data.activeProfileId });
        break;
      }
      case 'SET_ACTIVE_PROFILE': {
        data.activeProfileId = msg.profileId || null;
        await setData(data);
        sendResponse({ ok: true });
        break;
      }
      case 'GET_PROFILE': {
        const prof = data.profiles.find(p => p.id === data.activeProfileId) || data.profiles[0] || null;
        sendResponse({ ok: true, profile: prof });
        break;
      }
      default:
        sendResponse({ ok: false, error: 'Unknown message type' });
    }
  })();
  return true; // async
});
