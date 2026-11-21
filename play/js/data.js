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
    slime:    { name: "สไลม์",        zone: "meadow", lv: [1, 3],   hp: 34,  atk: 6,  def: 0,  spd: 46, xp: 9,   gold: 3,  r: 13, aggro: 130, color: "#6fd36f" },
    rabbit:   { name: "กระต่ายเขี้ยว", zone: "meadow", lv: [3, 6],   hp: 62,  atk: 10, def: 1,  spd: 78, xp: 15,  gold: 5,  r: 12, aggro: 160, color: "#f4f0e6" },
    wolf:     { name: "หมาป่าหมอก",   zone: "forest", lv: [6, 9],   hp: 130, atk: 17, def: 3,  spd: 84, xp: 30,  gold: 9,  r: 15, aggro: 190, color: "#8a93a6" },
    mushroom: { name: "เห็ดพิษ",      zone: "forest", lv: [8, 11],  hp: 175, atk: 22, def: 4,  spd: 50, xp: 38,  gold: 12, r: 14, aggro: 150, color: "#9b5de5" },
    scorpion: { name: "แมงป่องทราย",  zone: "desert", lv: [11, 14], hp: 280, atk: 32, def: 7,  spd: 72, xp: 62,  gold: 18, r: 16, aggro: 190, color: "#c98a3c" },
    mummy:    { name: "มัมมี่ซากเมือง", zone: "desert", lv: [13, 16], hp: 400, atk: 38, def: 9,  spd: 52, xp: 85,  gold: 24, r: 16, aggro: 170, color: "#e3d7b8" },
    yeti:     { name: "เยติหิมะ",     zone: "ice",    lv: [16, 20], hp: 640, atk: 50, def: 12, spd: 62, xp: 135, gold: 36, r: 20, aggro: 200, color: "#d6ecff" },
    boss:     { name: "ราชาหิมะ ฟรอสต์", zone: "ice", lv: [22, 22], hp: 6500, atk: 88, def: 20, spd: 66, xp: 2600, gold: 650, r: 34, aggro: 260, color: "#7fd8ff", boss: true },
  };
  PW.SPAWNS = { meadow: [["slime", 9], ["rabbit", 7]], forest: [["wolf", 9], ["mushroom", 7]], desert: [["scorpion", 8], ["mummy", 8]], ice: [["yeti", 12], ["boss", 1]] };

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
    mali: { id: "mali", name: "น้องมะลิ", title: "กิลด์ผจญภัย", x: 34.5, y: 30.2, guild: true, color: "#5aa9ff",
      face: "assets/img/npc_mali.webp", icon: "assets/img/npc_mali_icon.webp", voice: "Zephyr" },
    sak: { id: "sak", name: "ตาปู่ศักดิ์", title: "ผู้เฒ่านักเล่าตำนาน", x: 46.5, y: 30.2, color: "#b07bff",
      face: "assets/img/npc_sak.webp", icon: "assets/img/npc_sak_icon.webp", voice: "Charon" },
  };
})();
