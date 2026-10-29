import { ARMOR_ABSORB, MAX_HP, MAX_INPUT_BURST, THROWABLES, WEAPONS } from '@calculo-royale/shared/constants';
import { applyInput } from '@calculo-royale/shared/movement';
import { DEFAULT_SKIN } from '@calculo-royale/shared/skins';
import { freeSlot, magazineOf, newWeapon, noAttachments, slotsFor, startingKit } from '@calculo-royale/shared/inventory';

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
    this.meleeKills = 0;
    this.ants = 0; // hormigas culonas (7A)
    this.stats = { byTopic: {}, byLevel: {}, failed: [], history: [], adjusted: {}, correct: 0, answered: 0 };
    this.fiftyUsed = false; // comodín 50/50 (una vez por partida)
    this.fps = null;
    this.seenQuestions = new Set();
    this.place = null; // posición final (1 = ganador)
    this.gulagUsed = false; // ya tuvo su oportunidad en el Gulag (una por partida)
    // Para las medallas (fase 20)
    this.pickups = 0;
    this.longestKill = 0;
    this.damageDealt = 0;
    this.phrases = []; // momentos de sus frases rápidas recientes (antispam)
  }

  resetCombat() {
    this.alive = true;
    this.hp = MAX_HP;
    this.armorLevel = 0;
    this.armor = 0; // puntos que le quedan al chaleco
    // Inventario (fase 29): armas, munición por tipo, curaciones, lanzables y accesorios sueltos
    this.helmetLevel = 0;
    this.backpackLevel = 0;
    startingKit(this);
    this.nextFireAt = 0;
    this.nextGrenadeAt = 0;
    this.reloadUntil = 0;
    this.deathAt = 0;
    this.killedBy = null;
    this.killedWith = null;
    this.question = null; // { crateId, q, expiresAt } mientras abre una caja
    this.streak = 0;
    this.radarUntil = 0;
    this.operator = null; // { nextAt } mientras es espectador (preguntas de práctica)
    this.transmission = null; // pregunta de práctica o del Gulag en curso
    this.arena = null; // índice de la arena del Gulag donde pelea (null: en la partida)
    this.gulag = null; // { state: 'queue'|'fight', since, fightId } mientras está en el Gulag
    this.zip = null; // { from, to, len, t } colgado de una tirolina
    this.downed = null; // { until, by } derribado (dúos y escuadras)
    this.reviving = null; // { targetId, until, x, y, asked } levantando a un compañero
    this.padAt = null; // plataforma que acaba de usar (se rearma al alejarse)
    this.vehicleId = null; // vehículo en el que va
    this.seat = null; // 'driver' | 'passenger'
    this.engineQuestion = null; // código del motor pendiente
    this.ammoQuestion = null; // "Obtener balas" pendiente
    this.deploy = null; // { phase: 'bus' | 'pick' | 'fall' | 'chute', z } durante el despliegue
    this.ammoCooldownUntil = 0;
    this.offer = null; // premio de una caja por elegir: { crateId, options, x, y, until }
    this.flashUntil = 0; // aturdido (pantalla blanca, más lento)
    this.marks = null; // { ids, until, kind } enemigos marcados por un UAV o un sensor
    this.healing = null; // { item, until } mientras se venda o usa un botiquín
    this.drinkUntil = 0; // la bebida cura de a poco y da velocidad hasta este momento
    this.speedFactor = 1;
    this.recoil = 0; // retroceso acumulado (fase 25)
    this.recoilAt = 0;
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

  // Arma en mano (sin ninguna: puños)
  get hand() {
    return this.weapons[this.active] ?? null;
  }

  get weaponId() {
    return this.hand?.id ?? 'fists';
  }

  get attachments() {
    return this.hand?.att ?? noAttachments();
  }

  get mag() {
    return this.hand ? this.hand.mag : 999;
  }

  set mag(value) {
    if (this.hand) this.hand.mag = value;
  }

  // Reserva: la munición del tipo del arma en mano que hay en la mochila
  get reserve() {
    const type = WEAPONS[this.weaponId].ammo;
    return type ? (this.ammo[type] ?? 0) : 0;
  }

  set reserve(value) {
    const type = WEAPONS[this.weaponId].ammo;
    if (type) this.ammo[type] = Math.max(0, value);
  }

  // Un cargador de munición para el arma en mano ("Obtener balas" y bots); nunca cohetes. Devuelve su id
  addMagazine() {
    const id = this.weaponId;
    const type = WEAPONS[id].ammo;
    if (!type || type === 'rocket') return id;
    this.ammo[type] = (this.ammo[type] ?? 0) + magazineOf(id, this.attachments);
    return id;
  }

  // Armeros del campo de entrenamiento y equipo del Gulag: un arma con cargador lleno y algo de
  // munición (reemplaza la de su ranura), lanzables al máximo o el siguiente chaleco
  giveItem(item) {
    if (WEAPONS[item]) {
      const free = freeSlot(this, item);
      const slot = free >= 0 ? free : slotsFor(item)[0];
      this.weapons[slot] = newWeapon(item);
      const type = WEAPONS[item].ammo;
      if (type) this.ammo[type] = Math.max(this.ammo[type] ?? 0, WEAPONS[item].magazine * 2);
      this.active = slot;
      this.reloadUntil = 0;
    } else if (THROWABLES[item]) {
      this.throwables[item] = THROWABLES[item].max;
      this.throwSel = item;
    } else if (item === 'grenade') {
      this.throwables.frag = THROWABLES.frag.max;
      this.throwSel = 'frag';
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
      weapons: this.weapons.map((w) => w && { id: w.id, mag: w.mag, att: { ...w.att } }),
      melee: this.melee ?? null,
      active: this.active,
      ammo: { ...this.ammo },
      heals: { ...this.heals },
      throwables: { ...this.throwables },
      throwSel: this.throwSel,
      loose: [...this.loose],
      ammoCooldownLeft: Math.max(0, this.ammoCooldownUntil - now),
      helmetLevel: this.helmetLevel,
      backpackLevel: this.backpackLevel,
      offer: this.offer && { crateId: this.offer.crateId, options: this.offer.options },
      flashLeft: Math.max(0, this.flashUntil - now) > 0,
      marks: this.marks && this.marks.until > now ? { ids: this.marks.ids, kind: this.marks.kind } : null,
      healing: this.healing && { item: this.healing.item, ms: this.healing.until - this.healing.startedAt, left: Math.max(0, this.healing.until - now) },
      drinkLeft: Math.max(0, this.drinkUntil - now),
      speedFactor: this.speedFactor,
      reloadLeft: this.reloadUntil ? Math.max(0, this.reloadUntil - now) : 0,
      streak: this.streak,
      fiftyUsed: this.fiftyUsed,
      ants: this.ants ?? 0,
      hurtFrom: this.hurtFrom ?? null,
      radar: this.radarUntil > now,
      answering: this.question ? this.question.crateId : null,
      spectating: Boolean(this.operator),
      gulag: this.gulag && { state: this.gulag.state, since: this.gulag.since, fightId: this.gulag.fightId ?? null, choose: Boolean(this.gulag.choose) },
      gulagUsed: this.gulagUsed,
      kills: this.kills,
      downedLeft: this.downed ? Math.max(0, this.downed.until - now) : 0,
      downedHp: this.downed ? Math.max(0, Math.round(this.downed.hp)) : 0,
      reviving: this.reviving ? { targetId: this.reviving.targetId, left: Math.max(0, this.reviving.until - now) } : null,
      place: this.place,
      vehicle: this.vehicleId !== null ? { id: this.vehicleId, seat: this.seat } : null,
      killedBy: this.killedBy,
      killedWith: this.killedWith,
    };
  }

  info() {
    return { id: this.id, name: this.name, color: this.color, skin: this.skin, connected: this.connected, bot: this.bot || undefined, team: this.team ?? undefined, teamChoice: this.teamChoice ?? undefined };
  }
}
