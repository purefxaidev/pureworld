// Static game data (Thai). Hero art/voices are in assets/.
(function () {
  const PW = (window.PW = window.PW || {});

  PW.HEROES = {
    tank: {
      id: "tank", name: "เกราะแก้ว", role: "แทงก์", en: "Tank", color: "#e0a030",
      personality: "นักรบขี้โม้ ผู้คุ้มกันที่เชื่อว่าไม่มีใครทะลุเกราะตนได้",
      lines: ["เกราะข้านี้ ไม่มีใครทะลุได้หรอก!", "ไม่มีใครผ่านข้าไปได้!", "แข็งแกร่งขึ้นอีกแล้ว ใครจะมาท้า?"],
      base: { hp: 140, hpG: 22, mp: 40, mpG: 4, atk: 9, atkG: 1.7, def: 8, defG: 1.7, spd: 118, crit: 0.05 },
      ranged: false, range: 46, atkCd: 0.8, style: "ประชิดตัว · ทนทาน",
      skills: [
        { n: "โล่คำราม", d: "ตะโกนสะเทือน ศัตรูรอบตัวมึนและหันมาตีเธอ", cd: 6, mp: 8, type: "atk", ai: 90 },
        { n: "เกราะทอง", d: "สร้างเกราะดูดซับดาเมจให้ตัวเองและเพื่อนร่วมทีม", cd: 12, mp: 14, type: "buff", ai: 220 },
        { n: "สิงโตพิโรธ", d: "พุ่งชนไปข้างหน้า ศัตรูกระเด็นและเจ็บหนัก", cd: 10, mp: 18, type: "atk", ai: 160 },
      ],
    },
    fighter: {
      id: "fighter", name: "พยัคฆ์", role: "นักสู้", en: "Fighter", color: "#f08a24",
      personality: "นักสู้เลือดร้อน ชอบประชิดตัวและท้าทายคู่ต่อสู้",
      lines: ["มาสิ! ข้ายังไม่ทันอุ่นเครื่องเลย!", "คำรามหน่อย แล้วฟันให้สุด!", "เลือดเดือดขึ้นอีกขั้น ไปล่าต่อเลย!"],
      base: { hp: 112, hpG: 16, mp: 45, mpG: 5, atk: 12, atkG: 2.3, def: 5, defG: 1.0, spd: 128, crit: 0.1 },
      ranged: false, range: 46, atkCd: 0.6, style: "ประชิดตัว · ดาเมจสูง",
      skills: [
        { n: "ฟันคู่พยัคฆ์", d: "ฟันสองครั้งติดใส่ศัตรูตรงหน้า", cd: 4, mp: 6, type: "atk", ai: 70 },
        { n: "พายุพยัคฆ์", d: "หมุนตัวฟันศัตรูรอบด้าน", cd: 9, mp: 14, type: "atk", ai: 80 },
        { n: "คำรามเลือดเดือด", d: "เพิ่มพลังโจมตีและความเร็ว พร้อมฟื้นเลือด", cd: 14, mp: 16, type: "buff", ai: 200 },
      ],
    },
    mage: {
      id: "mage", name: "จันทรา", role: "จอมเวท", en: "Mage", color: "#5aa9ff",
      personality: "จอมเวทสายเย็นชา พูดน้อย คำนวณทุกอย่างอย่างเยือกเย็น",
      lines: ["อารมณ์ไม่มีประโยชน์... มีแต่ผลลัพธ์เท่านั้น", "จงเยือกแข็ง!", "พลังจันทร์เพิ่มขึ้นแล้ว... ตามที่คำนวณไว้"],
      base: { hp: 82, hpG: 11, mp: 90, mpG: 9, atk: 14, atkG: 2.7, def: 3, defG: 0.6, spd: 120, crit: 0.08 },
      ranged: true, range: 200, atkCd: 0.85, style: "ระยะไกล · เวทน้ำแข็ง",
      skills: [
        { n: "ลูกบอลน้ำแข็ง", d: "ยิงลูกน้ำแข็ง ทำให้ศัตรูช้าลง", cd: 3, mp: 8, type: "atk", ai: 240 },
        { n: "พายุหิมะ", d: "พายุหิมะถล่มเป็นวง ศัตรูช้าลง", cd: 9, mp: 18, type: "atk", ai: 220 },
        { n: "จันทร์ทัณฑ์", d: "ลำแสงจันทร์พุ่งทะลุ ดาเมจมหาศาล", cd: 16, mp: 30, type: "atk", ai: 280 },
      ],
    },
    marksman: {
      id: "marksman", name: "สายฟ้า", role: "มือธนู", en: "Marksman", color: "#34d6c0",
      personality: "มือธนูขี้เล่น มั่นใจในความแม่นยำ ชอบแซวเพื่อนในทีม",
      lines: ["หลับตาเล็งก็ยังโดนนะ ง่ายไปหรือเปล่า?", "สายฟ้า ไปซะ!", "แม่นขึ้นอีกแล้ว จะตามให้ทันมั้ย?"],
      base: { hp: 90, hpG: 12, mp: 60, mpG: 6, atk: 13, atkG: 2.5, def: 4, defG: 0.8, spd: 126, crit: 0.15 },
      ranged: true, range: 220, atkCd: 0.65, style: "ระยะไกล · ยิงแม่น",
      skills: [
        { n: "ยิงรัว", d: "ยิงลูกธนูสามดอกพร้อมกัน", cd: 4, mp: 6, type: "atk", ai: 230 },
        { n: "ธนูสายฟ้า", d: "ธนูสายฟ้าทะลุทะลวง ทำให้ศัตรูชะงัก", cd: 8, mp: 14, type: "atk", ai: 260 },
        { n: "ฝนธนู", d: "ฝนลูกธนูตกใส่พื้นที่เป็นวงกว้าง", cd: 14, mp: 24, type: "atk", ai: 240 },
      ],
    },
    assassin: {
      id: "assassin", name: "คมเงา", role: "นักฆ่า", en: "Assassin", color: "#a56bff",
      personality: "นักฆ่าเงียบขรึม พูดน้อย โผล่มาเมื่อไรศัตรูก็หมดทางหนี",
      lines: ["เมื่อเงาเคลื่อนที่... ก็สายเกินไปแล้ว", "จบแล้ว", "เงาลึกขึ้น... เหยื่อไม่มีทางหนี"],
      base: { hp: 92, hpG: 12, mp: 55, mpG: 5, atk: 14, atkG: 2.6, def: 4, defG: 0.8, spd: 142, crit: 0.22 },
      ranged: false, range: 42, atkCd: 0.5, style: "ประชิดตัว · คริติคอล",
      skills: [
        { n: "ก้าวเงา", d: "วาร์ปไปด้านหลังศัตรูและแทงคริติคอล", cd: 5, mp: 8, type: "atk", ai: 200 },
        { n: "มีดคู่พายุ", d: "ฟันรัวหลายครั้งรอบตัว", cd: 7, mp: 12, type: "atk", ai: 70 },
        { n: "สังหารเงียบ", d: "ดาเมจหนักมาก เลือดศัตรูต่ำยิ่งเจ็บ x2", cd: 15, mp: 22, type: "atk", ai: 160 },
      ],
    },
    support: {
      id: "support", name: "ไหมทอง", role: "ซัพพอร์ต", en: "Support", color: "#ff9ec2",
      personality: "ผู้สนับสนุนใจดีแต่ปากจัด คอยดูแลทีมและบ่นเมื่อเพื่อนเล่นเสี่ยง",
      lines: ["อย่าบุ่มบ่ามสิ! ข้าจะปกป้องเอง ถอยมาเลย!", "ไหมทองคุ้มครอง! ลุกขึ้นสิ!", "ยิ่งแข็งแกร่ง ยิ่งดูแลพวกเธอได้ดีกว่าเดิม"],
      base: { hp: 100, hpG: 14, mp: 80, mpG: 8, atk: 9, atkG: 1.6, def: 5, defG: 1.0, spd: 124, crit: 0.05 },
      ranged: true, range: 175, atkCd: 0.8, style: "ระยะไกล · ฮีลทีม",
      skills: [
        { n: "บัวฟื้นฟู", d: "ฟื้นเลือดให้ตัวเองและเพื่อนร่วมทีมรอบตัว", cd: 7, mp: 14, type: "heal", ai: 220 },
        { n: "ไหมทองคุ้มครอง", d: "เกราะไหมทองคุ้มกันทั้งทีม", cd: 12, mp: 18, type: "buff", ai: 220 },
        { n: "แสงบัวบาน", d: "แสงบัวระเบิดทำร้ายศัตรูและฟื้นเลือดทีม", cd: 14, mp: 26, type: "atk", ai: 130 },
      ],
    },
  };
  PW.HERO_ORDER = ["tank", "fighter", "mage", "marksman", "assassin", "support"];

  // Zones in tile units (map is 80x56, tile 32px). First match wins (priority order).
  PW.ZONES = [
    { id: "town", name: "เมืองพิวร์", lv: "เขตปลอดภัย", rect: [30, 21, 20, 14], safe: true, minimap: "#b9b1a0" },
    { id: "ice", name: "ยอดเขาน้ำแข็ง", lv: "Lv 16-22", rect: [18, 1, 44, 14], minimap: "#dcecf8", danger: 16 },
    { id: "desert", name: "ทะเลทรายซากเมือง", lv: "Lv 11-16", rect: [52, 8, 26, 28], minimap: "#dcc283", danger: 11 },
    { id: "forest", name: "ป่าหมอก", lv: "Lv 6-11", rect: [26, 38, 40, 16], minimap: "#3b7541", danger: 6 },
    { id: "meadow", name: "ทุ่งหญ้าเริ่มต้น", lv: "Lv 1-6", rect: [4, 14, 22, 30], minimap: "#7bc166" },
  ];

  PW.MONSTERS = {
    slime:    { name: "สไลม์",        zone: "meadow", lv: [1, 3],   hp: 34,  atk: 6,  def: 0,  spd: 46, xp: 9,   gold: 3,  r: 13, aggro: 80, color: "#6fd36f" },
    rabbit:   { name: "กระต่ายเขี้ยว", zone: "meadow", lv: [3, 6],   hp: 62,  atk: 10, def: 1,  spd: 78, xp: 15,  gold: 5,  r: 12, aggro: 90, color: "#f4f0e6" },
    wolf:     { name: "หมาป่าหมอก",   zone: "forest", lv: [6, 9],   hp: 130, atk: 17, def: 3,  spd: 84, xp: 30,  gold: 9,  r: 15, aggro: 110, color: "#8a93a6" },
    mushroom: { name: "เห็ดพิษ",      zone: "forest", lv: [8, 11],  hp: 175, atk: 22, def: 4,  spd: 50, xp: 38,  gold: 12, r: 14, aggro: 100, color: "#9b5de5" },
    scorpion: { name: "แมงป่องทราย",  zone: "desert", lv: [11, 14], hp: 280, atk: 32, def: 7,  spd: 72, xp: 62,  gold: 18, r: 16, aggro: 120, color: "#c98a3c" },
    mummy:    { name: "มัมมี่ซากเมือง", zone: "desert", lv: [13, 16], hp: 400, atk: 38, def: 9,  spd: 52, xp: 85,  gold: 24, r: 16, aggro: 110, color: "#e3d7b8" },
    yeti:     { name: "เยติหิมะ",     zone: "ice",    lv: [16, 20], hp: 640, atk: 50, def: 12, spd: 62, xp: 135, gold: 36, r: 20, aggro: 130, color: "#d6ecff" },
    boss:     { name: "ราชาหิมะ ฟรอสต์", zone: "ice", lv: [22, 22], hp: 6500, atk: 88, def: 20, spd: 66, xp: 2600, gold: 650, r: 34, aggro: 180, color: "#7fd8ff", boss: true },
  };
  PW.SPAWNS = { meadow: [["slime", 6], ["rabbit", 5]], forest: [["wolf", 7], ["mushroom", 6]], desert: [["scorpion", 7], ["mummy", 6]], ice: [["yeti", 8], ["boss", 1]] };

  PW.QUESTS = [
    { id: "q1", t: "กำจัดสไลม์ 8 ตัว", m: "slime", n: 8, gold: 80, xp: 120 },
    { id: "q2", t: "ล่ากระต่ายเขี้ยว 10 ตัว", m: "rabbit", n: 10, gold: 140, xp: 260 },
    { id: "q3", t: "ปราบหมาป่าหมอก 12 ตัว", m: "wolf", n: 12, gold: 300, xp: 700 },
    { id: "q4", t: "ล่าแมงป่องทราย 15 ตัว", m: "scorpion", n: 15, gold: 650, xp: 1800 },
    { id: "q5", t: "ปราบเยติหิมะ 10 ตัว", m: "yeti", n: 10, gold: 1200, xp: 4500 },
    { id: "q6", t: "โค่นราชาหิมะ ฟรอสต์", m: "boss", n: 1, gold: 3000, xp: 10000 },
  ];

  // Equipment
  PW.TIERS = [
    { name: "ฝึกหัด", lv: 1 }, { name: "เหล็กกล้า", lv: 5 }, { name: "เงินแท้", lv: 10 },
    { name: "ทองคำ", lv: 16, }, { name: "โอริฮาลคอน", lv: 24 }, { name: "มังกร", lv: 34 },
  ];
  PW.SLOTS = { weapon: "อาวุธ", armor: "เกราะ", charm: "เครื่องประดับ" };
  PW.RARITY = [
    { n: "ธรรมดา", m: 1, c: "#d8dde6" }, { n: "หายาก", m: 1.3, c: "#6cc0ff" }, { n: "มหากาพย์", m: 1.7, c: "#c47bff" },
  ];

  PW.NPCS = {
    prom: { id: "prom", name: "ป้าพรม", title: "ร้านยาสมุนไพร", x: 34.5, y: 26.7, shop: "potion", color: "#7ac27a",
      face: "assets/img/npc_prom.webp", icon: "assets/img/npc_prom_icon.webp", voice: "Vindemiatrix" },
    lek: { id: "lek", name: "ลุงเหล็ก", title: "โรงตีเหล็ก", x: 46.5, y: 26.7, shop: "gear", color: "#e08a3c",
      face: "assets/img/npc_lek.webp", icon: "assets/img/npc_lek_icon.webp", voice: "Orus" },
    mali: { id: "mali", name: "น้องมะลิ", title: "กิลด์ผจญภัย", x: 34.5, y: 35.8, guild: true, color: "#5aa9ff",
      face: "assets/img/npc_mali.webp", icon: "assets/img/npc_mali_icon.webp", voice: "Zephyr" },
    sak: { id: "sak", name: "ตาปู่ศักดิ์", title: "ผู้เฒ่านักเล่าตำนาน", x: 46.5, y: 35.8, color: "#b07bff",
      face: "assets/img/npc_sak.webp", icon: "assets/img/npc_sak_icon.webp", voice: "Charon" },
  };
})();
// v2 data: pets, minions (tamed monsters), passives, ultimates, skill upgrade rules.
(function () {
  const PW = window.PW;
  // bonus keys: atk, def, hp, mp, crit, spd (fractions), xp, gold (fractions), loot (pickup radius px)
  PW.PETS = {
    fox:      { name: "จิ้งจอกเพลิงชมพู", bonus: { atk: 0.08 }, color: "#ff7ab8", desc: "พลังโจมตี +8%" },
    dragon:   { name: "มังกรน้อยฟ้าคราม", bonus: { crit: 0.05 }, color: "#5ab4ff", desc: "คริติคอล +5%" },
    phoenix:  { name: "ลูกเจี๊ยบฟีนิกซ์", bonus: { hp: 0.1 }, color: "#ffb13c", desc: "HP สูงสุด +10%" },
    cloudcat: { name: "แมวเมฆ", bonus: { gold: 0.2, loot: 90 }, color: "#e8f4ff", desc: "ทอง +20% · ดูดของไกลขึ้น" },
    turtle:   { name: "เต่าใบไม้", bonus: { def: 0.12 }, color: "#7ad06a", desc: "ป้องกัน +12%" },
    starbat:  { name: "ค้างคาวดาวจันทร์", bonus: { xp: 0.15 }, color: "#b88aff", desc: "EXP +15%" },
  };
  PW.MINIONS = {
    slime:    { bonus: { hp: 0.06 }, desc: "HP +6%" },
    rabbit:   { bonus: { spd: 0.06 }, desc: "ความเร็ว +6%" },
    wolf:     { bonus: { atk: 0.07 }, desc: "โจมตี +7%" },
    mushroom: { bonus: { mp: 0.12 }, desc: "MP +12%" },
    scorpion: { bonus: { crit: 0.04 }, desc: "คริ +4%" },
    mummy:    { bonus: { def: 0.1 }, desc: "ป้องกัน +10%" },
    yeti:     { bonus: { hp: 0.12 }, desc: "HP +12%" },
    boss:     { bonus: { atk: 0.15, def: 0.08 }, desc: "โจมตี +15% · ป้องกัน +8%" },
  };
  PW.RARE = { slime: 1, rabbit: 1, wolf: 0.85, mushroom: 0.85, scorpion: 0.7, mummy: 0.7, yeti: 0.55, boss: 0.1 };
  PW.EVO = [{ n: "", m: 1, s: 1 }, { n: "✦", m: 1.6, s: 1.22 }, { n: "✦✦", m: 2.4, s: 1.45 }];
  PW.EVO_REQ = [{ lv: 10, gem: 1 }, { lv: 20, gem: 2 }];
  PW.PET_MAXLV = 30;
  PW.petXpNext = (l) => Math.round(30 * Math.pow(l, 1.45));
  // skill upgrades
  PW.SKILL_MAX = 10;
  PW.skillMul = (lv) => 1 + 0.13 * (lv - 1);              // damage/heal/shield
  PW.skillCdMul = (lv) => Math.max(0.64, 1 - 0.04 * (lv - 1)); // cooldown
  PW.skillAreaMul = (lv) => 1 + 0.05 * (lv - 1);          // radius
  PW.SKILL_MILESTONE = { 5: "ผลพิเศษ: ดาเมจคริติคอลแรงขึ้น +40% และใช้ MP น้อยลง 25%", 10: "ผลพิเศษ: สกิลสะท้อนซ้ำอีกครั้ง (50%) ฟรี" };
  PW.PASSIVES = {
    tank: { n: "ป้อมปราการไร้เทียมทาน", d: "HP +15% และป้องกัน +15%", lv: 5, cost: 2 },
    fighter: { n: "สายเลือดพยัคฆ์", d: "ดูดเลือด 8% จากดาเมจที่ทำ", lv: 5, cost: 2 },
    mage: { n: "จันทราอนันต์", d: "ดาเมจสกิล +15% และ MP ฟื้นเร็วขึ้น", lv: 5, cost: 2 },
    marksman: { n: "ตาเหยี่ยวสายฟ้า", d: "คริติคอล +10%", lv: 5, cost: 2 },
    assassin: { n: "เงาไร้รอย", d: "ความเร็ว +12% และดาเมจคริ +30%", lv: 5, cost: 2 },
    support: { n: "พรแห่งบัวทอง", d: "ทีมฟื้น HP ต่อเนื่อง 1.5%/วินาที", lv: 5, cost: 2 },
  };
  PW.ULTS = {
    tank: { n: "ป้อมสิงห์ทองคำ", d: "ระเบิดคลื่นสิงโต ศัตรูรอบตัวมึน 2.5 วิ ทีมได้เกราะใหญ่", cd: 40, mp: 30 },
    fighter: { n: "พยัคฆ์เพลิงคลั่ง", d: "ฟันรัว 8 ครั้งรอบตัว ได้บัฟโจมตี +60%", cd: 40, mp: 30 },
    mage: { n: "อุกกาบาตจันทรา", d: "อุกกาบาตน้ำแข็งตกใส่พื้นที่กว้าง ดาเมจมหาศาล", cd: 45, mp: 40 },
    marksman: { n: "พิโรธเทพอสนี", d: "สายฟ้าฟาดศัตรู 8 ตัวรอบตัว ชะงักทุกตัว", cd: 40, mp: 35 },
    assassin: { n: "พันเงาสังหาร", d: "วาร์ปฟันศัตรู 6 ตัวติดกัน คริทุกครั้ง", cd: 40, mp: 30 },
    support: { n: "พรเทพธิดาบัวสวรรค์", d: "ฟื้น HP ทีม 60% + ทำดาเมจรอบตัว + เกราะ", cd: 50, mp: 40 },
  };
  PW.ULT_LV = 10; PW.ULT_COST = 3;
  PW.SHOP_EXTRA = [
    ["crystal", 1, 60, "ผนึกวิญญาณ x1", "ใช้จับมอนสเตอร์ที่เลือดน้อยมาเป็นสมุน"],
    ["crystal", 5, 270, "ผนึกวิญญาณ x5", "ประหยัดกว่า"],
    ["egg", 1, 450, "ไข่สัตว์เลี้ยง", "ฟักได้สัตว์เลี้ยงสุ่ม 1 ใน 6 ตัว"],
    ["treat", 3, 120, "ขนมสัตว์เลี้ยง x3", "ให้สัตว์เลี้ยง/สมุน +EXP"],
    ["gem", 1, 900, "อัญมณีวิวัฒนาการ", "ใช้วิวัฒนาการสัตว์เลี้ยง/สมุน"],
  ];
})();
