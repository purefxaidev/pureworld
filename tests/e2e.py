"""PureWorld end-to-end test (headless Chrome via Playwright).
Usage: python3 tests/e2e.py [BASE_URL] [--live http://127.0.0.1:8787]
BASE_URL defaults to http://127.0.0.1:8080 (python3 -m http.server 8080 from repo root).
"""
import asyncio, json, sys, re, os
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _browser import launch_opts

BASE = "http://127.0.0.1:8080"
LIVE = None
args = sys.argv[1:]
if args and not args[0].startswith("--"): BASE = args.pop(0).rstrip("/")
if "--live" in args: LIVE = args[args.index("--live") + 1]
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "screens")
os.makedirs(SHOTS, exist_ok=True)
R = {"checks": [], "errors": []}

def check(name, ok, info=""):
    R["checks"].append({"name": name, "ok": bool(ok), "info": str(info)})
    print(("PASS " if ok else "FAIL ") + name + (" :: " + str(info) if info else ""), flush=True)

async def newpage(b, mobile, live=False):
    if mobile: ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, permissions=["microphone"])
    else: ctx = await b.new_context(viewport={"width": 1280, "height": 720}, permissions=["microphone"])
    pg = await ctx.new_page()
    pg.on("console", lambda m: R["errors"].append(m.type + ": " + m.text) if m.type in ("error",) else None)
    pg.on("pageerror", lambda e: R["errors"].append("pageerror: " + str(e)))
    await pg.add_init_script("window.__plays=[];const _p=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__plays.push(this.src.split('/').pop());return _p.apply(this,arguments)}")
    if live:
        await pg.route("**/js/config.js", lambda r: r.fulfill(body='window.PW_CONFIG={NPC_API_URL:"%s"};' % LIVE, content_type="application/javascript"))
    return ctx, pg

async def ev(pg, js): return await pg.evaluate(js)
async def shot(pg, name): await pg.screenshot(path=os.path.join(SHOTS, "v2_e2e_" + name))

async def run_game(b, mobile, tag):
    ctx, pg = await newpage(b, mobile)
    await pg.goto(BASE + "/play/?debug=1"); await pg.wait_for_function("window.__PW_READY===true")
    check(f"[{tag}] title loads", await pg.locator("#t-start").is_visible())
    check(f"[{tag}] manifest linked", await ev(pg, "!!document.querySelector('link[rel=manifest]')"))
    await pg.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.controller || true")
    sw = await ev(pg, "navigator.serviceWorker.ready.then(r=>!!r.active)")
    check(f"[{tag}] service worker active", sw)
    # select heroes
    names = {}
    for hid in ["tank", "fighter", "mage", "marksman", "assassin", "support"]:
        await pg.click(f'[data-hero="{hid}"]'); names[hid] = await pg.inner_text("#t-name")
    check(f"[{tag}] 6 heroines selectable", len(set(names.values())) == 6, names)
    await shot(pg, f"{tag}_01_title.png")
    plays = await ev(pg, "window.__plays")
    check(f"[{tag}] voice plays on select", any("support_1" in p for p in plays), plays[-3:])
    await pg.click('[data-hero="mage"]'); await pg.click("#t-start")
    await pg.wait_for_function("window.__PW.G.running===true")
    await pg.wait_for_timeout(1200)
    if await pg.locator("#hint").is_visible(): await pg.click("#hint-ok")
    check(f"[{tag}] game started as mage", await ev(pg, "window.__PW.G.hero.id") == "mage")
    await shot(pg, f"{tag}_02_town.png")
    # movement
    x0 = await ev(pg, "window.__PW.G.hero.x")
    if mobile:
        await ev(pg, """(async()=>{const z=document.getElementById('touchzone');const mk=(t,x,y)=>z.dispatchEvent(new PointerEvent(t,{pointerId:7,clientX:x,clientY:y,bubbles:true,pointerType:'touch'}));
          z.setPointerCapture=()=>{};mk('pointerdown',80,640);mk('pointermove',140,640);await new Promise(r=>setTimeout(r,700));window.__stickX=window.__PW.G.input.x;mk('pointerup',140,640);})()""")
        await pg.wait_for_timeout(900)
    else:
        await pg.keyboard.down("d"); await pg.wait_for_timeout(700); await pg.keyboard.up("d")
    x1 = await ev(pg, "window.__PW.G.hero.x")
    check(f"[{tag}] hero moves ({'touch stick' if mobile else 'keyboard'})", x1 > x0 + 20, f"{x0:.0f}->{x1:.0f}")
    # NPC chat fallback
    await ev(pg, "(()=>{const g=window.__PW.G;const n=g.npcs.find(n=>n.id==='mali');g.hero.x=n.x+20;g.hero.y=n.y+10;})()")
    await pg.wait_for_timeout(500)
    check(f"[{tag}] talk button near NPC", await pg.locator("#btn-talk").is_visible())
    await pg.click("#btn-talk"); await pg.wait_for_selector("#chat-log .msg.npc")
    st = await pg.inner_text("#chat-status")
    check(f"[{tag}] NPC fallback mode (no worker)", "บทพูด" in st, st)
    g1 = await pg.inner_text("#chat-log .msg.npc")
    await pg.fill("#chat-text", "ไปล่าที่ไหนดี"); await pg.click("#chat-send"); await pg.wait_for_timeout(900)
    msgs = await pg.locator("#chat-log .msg.npc").all_inner_texts()
    check(f"[{tag}] NPC replies in character (Thai)", len(msgs) >= 2 and re.search(r"[\u0E00-\u0E7F]", msgs[-1]) and msgs[-1] != g1, msgs[-1] if msgs else "")
    await shot(pg, f"{tag}_03_npc_chat.png")
    # shop via ป้าพรม
    await pg.click('[data-act="close"]')
    await ev(pg, "(()=>{const g=window.__PW.G;const n=g.npcs.find(n=>n.id==='prom');g.hero.x=n.x;g.hero.y=n.y+10;})()"); await pg.wait_for_timeout(400)
    await pg.click("#btn-talk"); await pg.wait_for_selector('[data-act="shop"]'); await pg.click('[data-act="shop"]'); await pg.wait_for_selector('[data-act="buy"]')
    hp0 = await ev(pg, "window.__PW.G.S.hpPot"); await pg.click('[data-act="buy"] >> nth=0'); hp1 = await ev(pg, "window.__PW.G.S.hpPot")
    check(f"[{tag}] shop buy potion", hp1 == hp0 + 1, f"{hp0}->{hp1}"); await shot(pg, f"{tag}_04_shop.png")
    await pg.click('[data-act="close"]')
    # gear shop buy + equip
    await ev(pg, "(()=>{const g=window.__PW.G;g.S.gold=5000;const n=g.npcs.find(n=>n.id==='lek');g.hero.x=n.x;g.hero.y=n.y+10;})()"); await pg.wait_for_timeout(400)
    await pg.click("#btn-talk"); await pg.click('[data-act="shop"]'); await pg.click('[data-act="buy"] >> nth=0'); await pg.click('[data-act="close"]')
    await pg.click("#hb-bag"); await pg.wait_for_selector('[data-act="equip"]'); atk0 = await ev(pg, "window.__PW.G.hero.atk"); await pg.click('[data-act="equip"] >> nth=0')
    atk1 = await ev(pg, "window.__PW.G.hero.atk"); eqn = await ev(pg, "Object.values(window.__PW.G.S.eq).filter(Boolean).length")
    check(f"[{tag}] buy + equip gear raises stats", eqn >= 1 and (atk1 > atk0 or await ev(pg, "window.__PW.G.hero.def")>0), f"atk {atk0:.1f}->{atk1:.1f}")
    await shot(pg, f"{tag}_05_bag.png"); await pg.click('[data-act="close"]')
    # party recruit
    await pg.click("#hb-party"); await pg.click('[data-act="recruit"][data-v="support"]'); await pg.click('[data-act="recruit"][data-v="tank"]')
    check(f"[{tag}] recruit 2 AI companions", await ev(pg, "window.__PW.G.allies.length") == 2, await ev(pg, "window.__PW.G.allies.map(a=>a.id)"))
    await shot(pg, f"{tag}_06_party.png"); await pg.click('[data-act="close"]')
    # combat: teleport to meadow, auto-hunt
    await ev(pg, "(()=>{const g=window.__PW.G;const m=g.monsters.find(m=>m.type==='slime');g.hero.x=m.x-60;g.hero.y=m.y;g.allies.forEach((a,i)=>{a.x=g.hero.x-20;a.y=g.hero.y+20*i});g.cam.x=g.hero.x;g.cam.y=g.hero.y;})()")
    await pg.wait_for_timeout(300)
    await pg.keyboard.press("2") if not mobile else await pg.click("#btn-s1")
    await pg.click("#btn-auto")
    lv0 = await ev(pg, "window.__PW.G.hero.level"); shot_taken = False
    for i in range(60):
        await pg.wait_for_timeout(1000)
        k, lv = await ev(pg, "[window.__PW.G.S.kills, window.__PW.G.hero.level]")
        if not shot_taken and k >= 1: await shot(pg, f"{tag}_07_fight.png"); shot_taken = True
        if k >= 4 and lv > lv0: break
    k, lv, gold, xp = await ev(pg, "[window.__PW.G.S.kills, window.__PW.G.hero.level, window.__PW.G.S.gold, window.__PW.G.hero.xp]")
    check(f"[{tag}] fight monsters (kills)", k >= 3, f"kills={k}")
    check(f"[{tag}] level up", lv > lv0, f"Lv{lv0}->{lv}")
    plays = await ev(pg, "window.__plays"); check(f"[{tag}] level-up/skill voice played", any("mage_3" in p for p in plays) and any("mage_2" in p for p in plays), [p for p in plays if p.startswith('mage')])
    await shot(pg, f"{tag}_08_levelup.png")
    # skills from every role quick sanity (cast without exceptions)
    errs0 = len(R["errors"])
    await ev(pg, """(()=>{const P=window.__PW.PW,g=window.__PW.G;for(const id of P.HERO_ORDER){const h=P.mkHero(id,5,false);h.x=g.hero.x;h.y=g.hero.y;for(let i=0;i<3;i++){h.cds[i]=0;try{P.castSkill(h,i)}catch(e){console.error('skill '+id+i+' '+e.message)}}}})()""")
    await pg.wait_for_timeout(500)
    check(f"[{tag}] all 18 skills cast without errors", len(R["errors"]) == errs0)
    # save & reload continue
    await pg.click("#btn-auto") if await ev(pg, "window.__PW.G.autoHunt") else None
    await ev(pg, "window.__PW.G.hero.hp=window.__PW.G.hero.maxHp");  # keep alive
    saved = await ev(pg, "(()=>{window.__PW.G.paused=true;window.__PW.PW.save();return JSON.parse(localStorage.getItem('pureworld_save_v1'))})()")
    lv = saved["level"]
    check(f"[{tag}] progress saved to localStorage", saved and saved["heroId"] == "mage" and saved["level"] >= 2, f"lv={saved['level']} gold={saved['gold']} kills={saved['kills']}")
    await pg.reload(); await pg.wait_for_function("window.__PW_READY===true")
    cont = await pg.locator("#t-continue").is_visible(); txt = await pg.inner_text("#t-continue") if cont else ""
    check(f"[{tag}] continue button after reload", cont and "Lv" in txt, txt)
    await pg.click("#t-continue"); await pg.wait_for_function("window.__PW.G.running===true")
    check(f"[{tag}] loaded progress", await ev(pg, "window.__PW.G.hero.level") == lv)
    await pg.wait_for_timeout(800); await shot(pg, f"{tag}_09_continue.png")
    await ctx.close()

async def run_live(b):
    ctx, pg = await newpage(b, True, live=True)
    reqs = []
    pg.on("request", lambda r: reqs.append(r.url))
    pg.on("websocket", lambda ws: reqs.append("WS " + ws.url))
    await pg.goto(BASE + "/play/?debug=1"); await pg.wait_for_function("window.__PW_READY===true")
    await pg.click('[data-hero="support"]'); await pg.click("#t-start"); await pg.wait_for_function("window.__PW.G.running===true")
    await ev(pg, "(()=>{const g=window.__PW.G;const n=g.npcs.find(n=>n.id==='sak');g.hero.x=n.x+10;g.hero.y=n.y+10;})()"); await pg.wait_for_timeout(400)
    await pg.click("#btn-talk")
    await pg.wait_for_function("(()=>{const c=document.getElementById('chat-status');return c.className.includes('live')||c.className.includes('rec')})()", timeout=20000)
    check("[live] connected via ephemeral token (status AI สด)", True, await pg.inner_text("#chat-status"))
    await pg.wait_for_selector("#chat-log .msg.npc", timeout=30000)
    await pg.wait_for_function("document.querySelector('#chat-log .msg.npc').textContent.length>5", timeout=30000)
    g = await pg.inner_text("#chat-log .msg.npc")
    check("[live] NPC greeted in Thai (Live native audio transcript)", re.search(r"[\u0E00-\u0E7F]", g), g)
    await pg.wait_for_timeout(3000)
    await pg.fill("#chat-text", "ตำนานราชาหิมะเป็นยังไงครับ"); await pg.click("#chat-send")
    await pg.wait_for_function("document.querySelectorAll('#chat-log .msg.npc').length>=2 && document.querySelectorAll('#chat-log .msg.npc')[1].textContent.length>8", timeout=40000)
    r = await pg.locator("#chat-log .msg.npc").nth(1).inner_text()
    check("[live] NPC answered typed question in character", re.search(r"[\u0E00-\u0E7F]", r), r)
    await pg.wait_for_timeout(9000)
    await shot(pg, "mobile_10_live_npc.png")
    # mic with fake device
    await pg.click("#chat-mic"); await pg.wait_for_timeout(2500)
    mic = await ev(pg, "!!document.querySelector('#chat-mic.rec')")
    check("[live] microphone streaming started (fake device)", mic, await pg.inner_text("#chat-status"))
    await pg.click("#chat-mic"); await pg.wait_for_timeout(500)
    leaked = [u for u in reqs if re.search(r"AIza|[?&]key=", u)]
    check("[live] no API key in any client request", not leaked, leaked)
    ws = [u for u in reqs if u.startswith("WS ")]
    check("[live] WebSocket uses BidiGenerateContentConstrained + access_token", ws and "BidiGenerateContentConstrained?access_token=auth_tokens" in ws[0], re.sub(r"auth_tokens%2F[0-9a-f]+", "auth_tokens/***", ws[0]) if ws else "")
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**launch_opts(["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]))
        await run_game(b, True, "mobile")
        await run_game(b, False, "desktop")
        if LIVE: await run_live(b)
        await b.close()
    check("no console errors / page errors", not R["errors"], R["errors"][:5])
    json.dump(R, open(os.path.join(SHOTS, "e2e-results.json"), "w"), ensure_ascii=False, indent=2)
    bad = [c for c in R["checks"] if not c["ok"]]
    print(f"\n{len(R['checks'])-len(bad)}/{len(R['checks'])} checks passed"); sys.exit(1 if bad else 0)
asyncio.run(main())
