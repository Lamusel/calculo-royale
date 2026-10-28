import { LOOT_IDS } from '@calculo-royale/shared/constants';

// Botín en el suelo tal como lo ve este cliente (fase 23). Se arma con los eventos del servidor:
// loot:sync (lista completa, al iniciar o reconectar), loot:add y loot:remove. `version` sube con
// cada cambio, y la escena redibuja cuando cambia. (Antes se comparaba "tamaño + versión": al
// tomar un objeto el tamaño bajaba 1 y la versión subía 1, la suma quedaba igual y el objeto
// tomado seguía dibujado.)
export class LootStore {
  constructor() {
    this.items = new Map(); // id → { id, item (null si es caja de botín), x, y, count, contents, tier, owner }
    this.version = 0;
  }

  // [id, índice en LOOT_IDS (−1 = caja de botín), x, y, cantidad, contenido [[índice, cantidad]], rareza, dueño]
  put([id, index, x, y, count, contents, tier = 0, owner = 0]) {
    this.items.set(id, {
      id, item: index >= 0 ? LOOT_IDS[index] : null, x, y, count, tier, owner,
      contents: Array.isArray(contents) ? contents.map(([i, n]) => ({ item: LOOT_IDS[i], n })) : null,
    });
  }

  sync(list) {
    this.items = new Map();
    for (const e of list) this.put(e);
    this.version++;
  }

  add(list) {
    for (const e of list) this.put(e);
    this.version++;
  }

  remove(ids) {
    for (const id of ids) this.items.delete(id);
    this.version++;
  }
}
