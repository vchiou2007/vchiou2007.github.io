export class LearningStorage {
  constructor() { this.db = null; }
  async open() {
    if (!globalThis.indexedDB) throw new Error('這個瀏覽器無法保存學習紀錄，請使用一般模式的 Safari。');
    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('poetry-pocket-learning', 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('state'); };
      request.onsuccess = () => { resolve(request.result); };
      request.onerror = () => reject(new Error('無法開啟本機學習資料，請檢查瀏覽器儲存空間。'));
      request.onblocked = () => reject(new Error('另一個視窗正在使用學習資料，請關閉後重新開啟。'));
    });
    this.db.onversionchange = () => this.db.close();
  }
  async read() {
    return new Promise((resolve, reject) => {
      const request = this.db.transaction('state', 'readonly').objectStore('state').get('current');
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(new Error('學習紀錄無法讀取；不會自動清除原資料。'));
    });
  }
  async write(state) {
    if (!this.db) throw new Error('本機儲存尚未就緒。');
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction('state', 'readwrite');
      transaction.objectStore('state').put(state, 'current');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('儲存失敗。這次變更未保存，請先匯出備份並檢查儲存空間。'));
      transaction.onabort = () => reject(new Error('儲存中斷。這次變更未保存。'));
    });
  }
  async update(reducer, fallback) {
    if (!this.db) throw new Error('本機儲存尚未就緒，這次變更未保存。');
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('state', 'readwrite');
      const table = tx.objectStore('state');
      let next, failure;
      const request = table.get('current');
      request.onsuccess = () => {
        try { next = reducer(request.result ?? fallback); table.put(next, 'current'); }
        catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(next);
      tx.onerror = tx.onabort = () => reject(failure || new Error('儲存失敗，這次變更未保存。請檢查瀏覽器儲存空間。'));
    });
  }
}
