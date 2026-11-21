// NPC dialogue: (1) scripted Thai personalities (offline fallback)  (2) Gemini Live client.
// The Live client only ever talks to YOUR token endpoint (PW_CONFIG.NPC_API_URL) + Google's Live WebSocket
// with a short-lived, single-use ephemeral token. No API key exists in this client.
(function () {
  const PW = (window.PW = window.PW || {});

  // ------------------------------------------------------------------ scripted
  const pick = (a, n) => a[n % a.length];
  const SC = {
    prom: {
      greet: (c) => [`โอ๊ะ ${c.heroName} มาแล้วเหรอจ๊ะ ระดับ ${c.level} แล้วนี่ เก่งขึ้นเยอะเลยนะลูก อย่าลืมพกยาแดงยาน้ำเงินไว้ด้วยนะ`, `มาๆ นั่งพักก่อนลูก ป้าชงน้ำสมุนไพรให้ ถ้าจะซื้อยา กดปุ่ม "ร้านค้า" ได้เลยจ้ะ`],
      rules: [
        { k: ["ยา", "ซื้อ", "ร้าน", "ราคา", "potion", "ขาย"], r: ["ยาแดงฟื้นเลือด ยาน้ำเงินฟื้นมานา ราคาไม่แพงหรอกจ้ะ กดปุ่ม \"ร้านค้า\" ข้างล่างได้เลยนะลูก", "พกยาไว้เยอะๆ นะ ไปป่าหมอกไม่ได้มีแต่หมาป่านะ ป้าเป็นห่วง"] },
        { k: ["เจ็บ", "ตาย", "เลือด", "ฟื้น"], r: ["เจ็บตรงไหนล่ะลูก ดื่มยาแดงสักขวดนะ แล้วอย่าบุ่มบ่ามบุกคนเดียวล่ะ", "ถ้าเลือดต่ำกว่าครึ่ง ให้ถอยก่อนนะจ๊ะ ชีวิตสำคัญกว่าค่าประสบการณ์"] },
        { k: ["สมุนไพร", "ทำ", "สูตร", "ความลับ"], r: ["สูตรยาป้าได้มาจากยายอีกที ใส่ใบบัวบกกับดอกมะลิป่านิดหน่อย ความลับจ้ะ ฮิๆ"] },
        { k: ["เหนื่อย", "เบื่อ", "ท้อ"], r: ["พักบ้างก็ได้นะลูก แต่พักเสร็จแล้วก็ไปต่อ ป้าเชียร์อยู่ตรงนี้เสมอจ้ะ"] },
      ],
      fallback: ["อืมๆ ป้าฟังอยู่นะลูก เล่าต่อสิ", "ป้าไม่ค่อยเข้าใจเรื่องนั้นหรอกจ้ะ แต่เรื่องยา ป้าเก่งนะ", "เอ้า ว่ามาเลยลูก ป้ามีเวลาคุยทั้งวัน"],
    },
    lek: {
      greet: (c) => [`หึ ${c.heroName} เหรอ เลเวล ${c.level} แล้ว ดาบเอ็งยังไหวอยู่มั้ย เอามาให้ลุงดูหน่อยโว้ย`, `เข้ามาๆ อย่ายืนบังเตาข้า! จะซื้ออาวุธก็กดปุ่ม "ร้านค้า" เลย`],
      rules: [
        { k: ["อาวุธ", "ดาบ", "เกราะ", "ซื้อ", "ร้าน", "ขาย", "ของ"], r: ["อาวุธข้าคมที่สุดในแผ่นดินเว้ย! กดปุ่ม \"ร้านค้า\" ดูของได้เลย", "ของดีมีราคาโว้ย ไปล่าเหรียญมาให้เยอะๆ ก่อน แล้วค่อยมาเลือก"] },
        { k: ["เก่ง", "ฝีมือ", "ตี"], r: ["ฮ่าๆ รู้ดีนี่ ข้าตีเหล็กมาสี่สิบปี ค้อนข้านี่เคยตีทะลุหินมาแล้ว", "ฝีมือข้ามันต้องยอมรับโว้ย ไม่ต้องชมก็ได้ ข้าไม่เขินหรอก... นิดหน่อย"] },
        { k: ["แร่", "เหล็ก", "ทอง"], r: ["แร่ดีๆ ต้องไปเอาที่ยอดเขาน้ำแข็ง แต่เยติมันดุนะ ไม่ใช่งานเด็กๆ"] },
        { k: ["สู้", "บอส", "ราชา"], r: ["อยากสู้ราชาหิมะเรอะ ใส่ชุดทองขึ้นไปก่อนค่อยว่ากัน ไอ้หนู!"] },
      ],
      fallback: ["เออ ว่าไปโว้ย ข้าฟังอยู่", "ข้าไม่ถนัดคุยเล่นหรอก ถ้าไม่ซื้ออะไรก็อย่าขวางทางลูกค้า... ล้อเล่นเว้ย", "หืม? พูดอะไรของเอ็ง ข้าไม่เข้าใจ"],
    },
    mali: {
      greet: (c) => [`สวัสดีค่ะคุณ ${c.heroName}! ตอนนี้เลเวล ${c.level} แล้วนะคะ เก่งมากเลย วันนี้จะรับภารกิจหรือเรียกเพื่อนร่วมทีมดีคะ`, `ยินดีต้อนรับสู่กิลด์ผจญภัยค่า! กดปุ่ม "ภารกิจ" เพื่อรับรางวัล หรือปุ่ม "ทีม" เพื่อเรียกฮีโร่คนอื่นมาช่วยสู้ได้เลยนะคะ`],
      rules: [
        { k: ["ภารกิจ", "เควส", "quest", "รางวัล"], r: ["ภารกิจมีลำดับนะคะ ทำข้อแรกให้เสร็จแล้วกดรับรางวัลในเมนู \"ภารกิจ\" ได้เลยค่ะ", "รางวัลเป็นทั้งเหรียญและค่าประสบการณ์ เยอะมากเลยนะคะ สู้ๆ ค่า!"] },
        { k: ["ทีม", "เพื่อน", "ช่วย", "party"], r: ["เรียกเพื่อนร่วมทีมได้สูงสุด 2 คนค่ะ กดปุ่ม \"ทีม\" แล้วเลือกฮีโร่ที่อยากได้เลยนะคะ ทุกคนสู้เองอัตโนมัติด้วย!"] },
        { k: ["ไหน", "ล่า", "เลเวล", "เก็บ", "อัพ", "เลเวลอัป"], r: ["เลเวล 1-5 ไปทุ่งหญ้าทางตะวันตกค่ะ, 6-11 ป่าหมอกทางใต้, 11-16 ทะเลทรายทางตะวันออก, 16 ขึ้นไปยอดเขาน้ำแข็งทางเหนือเลยค่ะ", "ถ้าอยากเก็บเลเวลสบายๆ เปิดโหมด \"ล่าอัตโนมัติ\" แล้วให้ทีมช่วยตีได้นะคะ"] },
        { k: ["บอส", "ราชา", "ฟรอสต์"], r: ["ราชาหิมะอยู่บนยอดเขาเหนือค่ะ แนะนำเลเวล 22 ขึ้นไป และอย่าลืมพาทีมไปด้วยนะคะ!"] },
        { k: ["ชอบ", "รัก", "น่ารัก"], r: ["ว้าย ขอบคุณค่า มะลิเขินนะคะเนี่ย รีบไปทำภารกิจเถอะค่ะ ฮิๆ"] },
      ],
      fallback: ["ค่ะๆ มะลิรับทราบค่ะ มีอะไรให้ช่วยอีกมั้ยคะ", "เรื่องนั้นมะลิไม่แน่ใจค่ะ แต่เรื่องภารกิจกับทีม ถามได้เลยนะคะ!", "สู้ๆ นะคะ มะลิเอาใจช่วยอยู่ที่กิลด์ค่า"],
    },
    sak: {
      greet: (c) => [`อืม... ลมพัดพา ${c.heroName} มาหาข้าอีกแล้วสินะ เลเวล ${c.level} แล้ว เส้นทางเจ้ายังอีกยาวไกลนัก`, `นั่งลงเถิดเจ้าหนู ข้ามีเรื่องเล่าเก่าแก่ของ PureWorld ให้ฟังมากมาย`],
      rules: [
        { k: ["ตำนาน", "เรื่องเล่า", "อดีต", "ประวัติ", "เล่า"], r: ["กาลก่อน ราชาหิมะ ฟรอสต์ ปลุกพายุน้ำแข็งกลืนยอดเขาเหนือ มีเพียงฮีโร่ทั้งหกเท่านั้นที่จะหยุดมันได้... นั่นคือเจ้าและเพื่อนๆ ไงล่ะ", "โลกนี้มีหกพลัง ทั้งโล่ ดาบ จันทร์ ธนู เงา และบัว หากรวมกัน แม้พายุก็ต้องสงบ"] },
        { k: ["บอส", "ราชา", "ฟรอสต์", "ชนะ"], r: ["ราชาหิมะกลัวไฟและความสามัคคี พาเพื่อนร่วมทีมไปด้วยเถิด และอย่าลืมเกราะดีๆ", "จงจำไว้ ศัตรูใหญ่ไม่ได้แพ้เพราะพลังเดียว แต่แพ้เพราะความอดทน"] },
        { k: ["เลเวล", "เก็บ", "อัพ", "เก่ง", "แข็งแกร่ง"], r: ["การฝึกฝนคือเพื่อนแท้ ล่าสัตว์ในโซนที่พอดีกับเลเวล ได้ทั้งค่าประสบการณ์และของดี", "ใจเย็นๆ เจ้าหนู ผู้ที่ไปไกลคือผู้ที่เดินอย่างมั่นคง"] },
        { k: ["ลับ", "ปริศนา", "สมบัติ"], r: ["ความลับน่ะรึ... ใต้ซากเมืองทะเลทรายหลับใหลบางสิ่งอยู่ แต่เวลายังไม่ถึงนะ"] },
      ],
      fallback: ["อืม... น่าสนใจ ข้าจะครุ่นคิดดู", "คำถามของเจ้า ลมกระซิบตอบข้าไม่ได้เสียแล้ว ฮ่าๆ", "เวลาเดินช้าสำหรับคนแก่ แต่ปัญญาไม่เคยหยุดนิ่งนะ"],
    },
  };
  const COMMON = [
    { k: ["สวัสดี", "หวัดดี", "ดีจ้า", "hello", "hi"], t: (n, c) => ["greet"] },
    { k: ["ขอบคุณ", "ขอบใจ", "thanks"], r: { prom: ["ไม่เป็นไรจ้ะลูก ดูแลตัวเองด้วยนะ"], lek: ["เออๆ ไม่ต้องขอบใจ ไปตีมอนมาเยอะๆ ก็พอโว้ย"], mali: ["ยินดีค่า! สู้ๆ นะคะ"], sak: ["ยินดีเถิด เจ้าหนู"] } },
    { k: ["ชื่อ", "ใคร"], r: { prom: ["ป้าพรมไงลูก เจ้าของร้านยาหัวมุมนี้เอง"], lek: ["ลุงเหล็ก! ช่างตีเหล็กหมายเลขหนึ่งแห่งเมืองพิวร์"], mali: ["มะลิค่ะ พนักงานต้อนรับกิลด์ผจญภัยค่ะ"], sak: ["ผู้คนเรียกข้าว่า ตาปู่ศักดิ์ ผู้เฒ่านักเล่าตำนาน"] } },
    { k: ["ลาก่อน", "บาย", "ไปแล้ว", "bye"], r: { prom: ["ระวังตัวด้วยนะลูก กลับมาหาป้าบ้างล่ะ"], lek: ["ไปๆ แล้วอย่าลืมดูแลอาวุธโว้ย"], mali: ["เดินทางปลอดภัยนะคะ แล้วกลับมารับรางวัลด้วยค่ะ!"], sak: ["ขอให้ดวงดาวนำทางเจ้า"] } },
  ];
  let counter = 0;
  PW.scriptedGreeting = (id, ctx) => pick(SC[id].greet(ctx), counter++);
  PW.scriptedReply = (id, text, ctx) => {
    const t = (text || "").toLowerCase();
    const s = SC[id];
    for (const g of COMMON) {
      if (g.k.some((w) => t.includes(w))) {
        if (g.t) return pick(s.greet(ctx), counter++);
        return pick(g.r[id], counter++);
      }
    }
    for (const r of s.rules) if (r.k.some((w) => t.includes(w))) return pick(r.r, counter++);
    return pick(s.fallback, counter++);
  };

  // ------------------------------------------------------------------ Live client
  const LIVE_WS = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=";
  const b64ToBytes = (b64) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  const bytesToB64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };

  PW.liveSupported = () => !!(window.PW_CONFIG && window.PW_CONFIG.NPC_API_URL && "WebSocket" in window);

  PW.LiveNPC = class {
    constructor(opts) {
      this.o = opts; // {apiUrl, npcId, hero:{id,level}, on:{status,npcText,userText,turnEnd}}
      this.ready = false; this.closed = false; this.q = Promise.resolve();
      this.ac = null; this.playT = 0; this.srcs = []; this.audioOn = true;
      this.mic = null; this.micBuf = []; this.micLen = 0;
    }
    status(s, extra) { try { this.o.on.status(s, extra); } catch (e) { /* ignore */ } }
    async start() {
      this.status("connecting");
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !this.ac) { try { this.ac = new AC(); if (this.ac.state === "suspended") this.ac.resume(); } catch (e) { this.ac = null; } }
      const base = this.o.apiUrl.replace(/\/+$/, "");
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 9000);
      let j;
      try {
        const r = await fetch(base + "/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ npc: this.o.npcId, hero: this.o.hero }), signal: ctrl.signal });
        if (!r.ok) throw new Error("token_http_" + r.status);
        j = await r.json();
        if (!j.token) throw new Error("no_token");
      } finally { clearTimeout(to); }
      await new Promise((resolve, reject) => {
        const ws = new WebSocket(LIVE_WS + encodeURIComponent(j.token));
        this.ws = ws;
        const t = setTimeout(() => { reject(new Error("ws_timeout")); try { ws.close(); } catch (e) { /* */ } }, 10000);
        ws.onopen = () => ws.send(JSON.stringify({ setup: { model: "models/" + j.model } })); // persona/voice are locked in the token
        ws.onmessage = (ev) => {
          this.q = this.q.then(async () => {
            let txt = typeof ev.data === "string" ? ev.data : await ev.data.text();
            let m; try { m = JSON.parse(txt); } catch (e) { return; }
            if (m.setupComplete && !this.ready) { this.ready = true; clearTimeout(t); resolve(); }
            this._handle(m);
          });
        };
        ws.onerror = () => { clearTimeout(t); if (!this.ready) reject(new Error("ws_error")); };
        ws.onclose = (e) => { clearTimeout(t); if (!this.ready) reject(new Error("ws_closed_" + e.code)); else if (!this.closed) { this.ready = false; this.status("closed", e.code); } };
      });
      this.status("ready");
    }
    _handle(m) {
      const sc = m.serverContent;
      if (!sc) { if (m.goAway) this.status("closed"); return; }
      if (sc.interrupted) this.stopPlayback();
      for (const p of (sc.modelTurn && sc.modelTurn.parts) || []) if (p.inlineData && p.inlineData.data) this._play(p.inlineData.data);
      if (sc.inputTranscription && sc.inputTranscription.text) this.o.on.userText(sc.inputTranscription.text);
      if (sc.outputTranscription && sc.outputTranscription.text) this.o.on.npcText(sc.outputTranscription.text);
      if (sc.turnComplete) this.o.on.turnEnd();
    }
    _play(b64) {
      if (!this.ac || !this.audioOn) return;
      const u8 = b64ToBytes(b64); const n = u8.length >> 1; if (!n) return;
      const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      const buf = this.ac.createBuffer(1, n, 24000); const ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) ch[i] = dv.getInt16(i * 2, true) / 32768;
      const s = this.ac.createBufferSource(); s.buffer = buf; s.connect(this.ac.destination);
      const now = this.ac.currentTime; if (this.playT < now + 0.03) this.playT = now + 0.05;
      s.start(this.playT); this.playT += buf.duration; this.srcs.push(s);
      s.onended = () => { this.srcs = this.srcs.filter((x) => x !== s); };
      this.status("speaking");
    }
    stopPlayback() { for (const s of this.srcs) { try { s.stop(); } catch (e) { /* */ } } this.srcs = []; this.playT = 0; }
    sendText(text) {
      if (!this.ready || !this.ws || this.ws.readyState !== 1) return false;
      this.stopPlayback();
      this.ws.send(JSON.stringify({ realtimeInput: { text } }));
      return true;
    }
    async startMic() {
      if (!this.ready) throw new Error("not_ready");
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("no_mic_api");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (this.ac.state === "suspended") await this.ac.resume();
      const src = this.ac.createMediaStreamSource(stream);
      const sink = this.ac.createGain(); sink.gain.value = 0; sink.connect(this.ac.destination);
      const onChunk = (f32) => this._mic(f32);
      let node, kind;
      try {
        const code = "class P extends AudioWorkletProcessor{process(i){const c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor('pw-cap',P)";
        const url = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
        await this.ac.audioWorklet.addModule(url); URL.revokeObjectURL(url);
        node = new AudioWorkletNode(this.ac, "pw-cap"); node.port.onmessage = (e) => onChunk(e.data); kind = "worklet";
      } catch (e) {
        node = this.ac.createScriptProcessor(2048, 1, 1); node.onaudioprocess = (e) => onChunk(new Float32Array(e.inputBuffer.getChannelData(0))); kind = "script";
      }
      src.connect(node); node.connect(sink);
      this.mic = { stream, src, node, sink, kind };
      this.status("listening");
    }
    _mic(f32) {
      if (!this.ws || this.ws.readyState !== 1 || !this.ready) return;
      const ratio = this.ac.sampleRate / 16000;
      this._acc = (this._acc || []); this._accN = (this._accN || 0);
      // naive averaging downsample
      const out = new Int16Array(Math.floor(f32.length / ratio));
      for (let i = 0; i < out.length; i++) {
        const a = Math.floor(i * ratio), b = Math.min(f32.length, Math.floor((i + 1) * ratio)); let s = 0;
        for (let k = a; k < b; k++) s += f32[k];
        const v = Math.max(-1, Math.min(1, s / Math.max(1, b - a))); out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
      }
      this._acc.push(out); this._accN += out.length;
      if (this._accN >= 1600) {
        const all = new Int16Array(this._accN); let o = 0; for (const c of this._acc) { all.set(c, o); o += c.length; }
        this._acc = []; this._accN = 0;
        this.ws.send(JSON.stringify({ realtimeInput: { audio: { data: bytesToB64(new Uint8Array(all.buffer)), mimeType: "audio/pcm;rate=16000" } } }));
      }
    }
    stopMic() {
      const m = this.mic; if (!m) return; this.mic = null;
      try { m.node.disconnect(); m.src.disconnect(); m.sink.disconnect(); } catch (e) { /* */ }
      m.stream.getTracks().forEach((t) => t.stop());
      if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
      this._acc = []; this._accN = 0;
      this.status("ready");
    }
    close() {
      this.closed = true; this.stopMic(); this.stopPlayback();
      try { this.ws && this.ws.close(); } catch (e) { /* */ }
      try { this.ac && this.ac.close(); } catch (e) { /* */ }
      this.ready = false;
    }
  };
})();
