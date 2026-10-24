import { ARMOR_ABSORB, GRENADE, MAX_HP, MAX_INPUT_BURST, WEAPONS } from '@calculo-royale/shared/constants';
import { applyInput } from '@calculo-royale/shared/movement';
import { DEFAULT_SKIN } from '@calculo-royale/shared/skins';
import { magazineOf, noAttachments } from '@calculo-royale/shared/inventory';

// Ticks de historia de posiciones para la compensación de lag
const HISTORY_TICKS = 10;

export class Player {
  constructor({ id, name, color, token }) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.token = token;
    this.skin = DEFAULT_SKIN;
    this.bot = false; // bot del servidor (fase 20)

    this.x = 0;
    this.y = 0;
    this.aim = 0;
    this.history = []; // [{ tick, x, y }]

    this.inputs = [];
    this.lastQueuedSeq = 0;
    this.lastSeq = 0; // último input aplicado (el cliente lo usa para reconciliar)
    this.inputBudget = MAX_INPUT_BURST;

    this.socketId = null;
    this.connected = false;
    this.removeTimer = null;

    this.resetStats();
    this.resetCombat();
  }

  // Estadísticas de la partida (bajas y aciertos por tema); se reinician al iniciar
  resetStats() {
    this.kills = 0;
    this.stats = { byTopic: {}, failed: [], correct: 0, answered: 0 };
    this.seenQuestions = new Set();
    this.place = null; // posición final (1 = ganador)
    this.revived = false; // ya usó su reanimación de operador
    // Para las medallas (fase 20)
    this.pickups = 0;
    this.longestKill = 0;
    this.damageDealt = 0;
    this.phrases = []; // momentos de sus frases rápidas recientes (antispam)
    this.bossDamage = 0; // daño hecho al jefe (modo jefe)
  }

  resetCombat() {
    this.alive = true;
    this.hp = MAX_HP;
    this.armorLevel = 0;
    this.armor = 0; // puntos que le quedan al chaleco
    this.pistolMag = WEAPONS.pistol.magazine;
    this.pistolReserve = WEAPONS.pistol.reserve;
    this.primary = null; // { id, mag, reserve }
    this.slot = 1;
    this.grenades = 0;
    this.nextFireAt = 0;
    this.nextGrenadeAt = 0;
    this.reloadUntil = 0;
    this.deathAt = 0;
    this.killedBy = null;
    this.killedWith = null;
    this.question = null; // { crateId, q, expiresAt } mientras abre una caja
    this.streak = 0;
    this.radarUntil = 0;
    this.operator = null; // { mode: 'revive'|'votes', streak, sector, nextAt } mientras está caído
    this.transmission = null; // pregunta de operador en curso
    this.intercept = null; // pregunta de intercepción en curso
    this.intel = null; // centro de la próxima zona, si ganó una intercepción
    this.vehicleId = null; // jeep en el que va
    this.seat = null; // 'driver' | 'passenger'
    this.engineQuestion = null; // código del motor pendiente
    this.ammoQuestion = null; // "Obtener balas" pendiente
    this.deploy = null; // { phase: 'bus' | 'pick' | 'fall' | 'chute', z } durante el despliegue
    this.ammoCooldownUntil = 0;
    // Botín de battle royale (fase 18)
    this.helmetLevel = 0;
    this.backpackLevel = 0;
    this.bandages = 0;
    this.medkits = 0;
    this.drinks = 0;
    this.attachments = noAttachments();
    this.healing = null; // { item, until } mientras se venda o usa un botiquín
    this.drinkUntil = 0; // la bebida cura de a poco y da velocidad hasta este momento
    this.speedFactor = 1;
    this.recoil = 0; // retroceso acumulado (fase 25)
    this.recoilAt = 0;
    // Modo jefe (fase 21)
    this.bossQuestion = null; // pregunta de escudo o de volver pendiente
    this.reviveAt = 0;
    this.bossCooldownUntil = 0;
  }

  // Cayendo del bus: el movimiento compartido usa otra velocidad y no choca
  get air() {
    const phase = this.deploy?.phase;
    return phase === 'fall' || phase === 'chute' ? phase : null;
  }

  // En el aire o todavía en el bus: no dispara, no recibe daño, no interactúa
  get deploying() {
    return this.deploy !== null;
  }

  get weaponId() {
    return this.slot === 2 && this.primary ? this.primary.id : 'pistol';
  }

  get mag() {
    return this.weaponId === 'pistol' ? this.pistolMag : this.primary.mag;
  }

  set mag(value) {
    if (this.weaponId === 'pistol') this.pistolMag = value;
    else this.primary.mag = value;
  }

  get reserve() {
    return this.weaponId === 'pistol' ? this.pistolReserve : this.primary.reserve;
  }

  set reserve(value) {
    if (this.weaponId === 'pistol') this.pistolReserve = value;
    else this.primary.reserve = value;
  }

  // Un cargador de reserva para el arma en mano (cajas y "Obtener balas"); devuelve su id
  addMagazine() {
    const id = this.weaponId;
    this.reserve += WEAPONS[id].magazine;
    return id;
  }

  giveItem(item) {
    if (WEAPONS[item]) {
      const w = WEAPONS[item];
      this.primary = { id: item, mag: magazineOf(item, this.attachments), reserve: w.reserve };
      this.slot = 2;
      this.reloadUntil = 0;
    } else if (item === 'grenade') {
      this.grenades = GRENADE.max;
    } else if (item === 'armor') {
      this.armorLevel = (this.armorLevel % 3) + 1;
      this.armor = ARMOR_ABSORB[this.armorLevel];
    }
  }

  queueInput(input) {
    if (input.seq <= this.lastQueuedSeq) return;
    this.lastQueuedSeq = input.seq;
    this.inputs.push(input);
    if (this.inputs.length > MAX_INPUT_BURST * 2) this.inputs.shift();
  }

  // Aplica los inputs en cola. El presupuesto sube 1 por tick: en promedio
  // nadie se mueve más rápido que un input por tick aunque envíe más.
  // `move` mueve al jugador (a pie o en jeep); onInput recibe cada input ya aplicado.
  processInputs(dt, onInput, move = applyInput) {
    this.inputBudget = Math.min(this.inputBudget + 1, MAX_INPUT_BURST);
    while (this.inputs.length > 0 && this.inputBudget >= 1) {
      const input = this.inputs.shift();
      if (this.alive) {
        move(this, input, dt);
        onInput(input);
      }
      this.lastSeq = input.seq;
      this.inputBudget -= 1;
    }
  }

  // Al reconectar, el cliente reinicia su contador de secuencia
  resetInputs() {
    this.inputs = [];
    this.lastQueuedSeq = 0;
    this.lastSeq = 0;
  }

  teleport(x, y) {
    this.x = x;
    this.y = y;
    this.inputs = [];
    this.history = [];
  }

  recordHistory(tick) {
    this.history.push({ tick, x: this.x, y: this.y });
    if (this.history.length > HISTORY_TICKS) this.history.shift();
  }

  // Posición en un tick pasado (puede ser fraccionario), interpolando la historia
  positionAt(tick) {
    const h = this.history;
    if (h.length === 0 || tick >= h[h.length - 1].tick) return { x: this.x, y: this.y };
    if (tick <= h[0].tick) return { x: h[0].x, y: h[0].y };
    for (let i = h.length - 1; i > 0; i--) {
      const a = h[i - 1];
      if (a.tick <= tick) {
        const b = h[i];
        const t = (tick - a.tick) / (b.tick - a.tick);
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
    }
    return { x: this.x, y: this.y };
  }

  // Estado privado que solo ve el dueño (se envía cuando cambia)
  selfState(now) {
    return {
      alive: this.alive,
      hp: Math.ceil(this.hp),
      armorLevel: this.armorLevel,
      armor: Math.ceil(this.armor),
      slot: this.slot,
      pistolMag: this.pistolMag,
      pistolReserve: this.pistolReserve,
      ammoCooldownLeft: Math.max(0, this.ammoCooldownUntil - now),
      primary: this.primary && { ...this.primary },
      grenades: this.grenades,
      helmetLevel: this.helmetLevel,
      backpackLevel: this.backpackLevel,
      bandages: this.bandages,
      medkits: this.medkits,
      drinks: this.drinks,
      attachments: { ...this.attachments },
      healing: this.healing && { item: this.healing.item, ms: this.healing.until - this.healing.startedAt, left: Math.max(0, this.healing.until - now) },
      drinkLeft: Math.max(0, this.drinkUntil - now),
      speedFactor: this.speedFactor,
      reloadLeft: this.reloadUntil ? Math.max(0, this.reloadUntil - now) : 0,
      streak: this.streak,
      radar: this.radarUntil > now,
      answering: this.question ? this.question.crateId : null,
      operator: this.operator && { mode: this.operator.mode, streak: this.operator.streak, sector: this.operator.sector },
      revived: this.revived,
      intel: this.intel && { cx: this.intel.cx, cy: this.intel.cy },
      vehicle: this.vehicleId !== null ? { id: this.vehicleId, seat: this.seat } : null,
      killedBy: this.killedBy,
      reviveIn: !this.alive && this.reviveAt ? Math.max(0, this.reviveAt - now) : null,
      bossCooldown: this.bossCooldownUntil > now,
      killedWith: this.killedWith,
    };
  }

  info() {
    return { id: this.id, name: this.name, color: this.color, skin: this.skin, connected: this.connected, bot: this.bot || undefined };
  }
}
