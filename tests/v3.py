"""PureWorld v3 test: frame animation (atlases, state machine, lazy loading), evolved pet art, procedural audio,
settings (volume + graphics quality), screen transitions.  Usage: python3 tests/v3.py [BASE_URL] [--video]
Runs on a mobile viewport (iPhone-sized, emulated in Chrome) and a desktop viewport. Writes screens/v3_*.png (+ v3_anim.mp4 with --video)."""
import asyncio, json, os, subprocess, sys
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _browser import launch_opts, base_url

BASE = base_url(sys.argv); VIDEO = "--video" in sys.argv
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "screens"); os.makedirs(SHOTS, exist_ok=True)
R = {"checks": [], "errors": []}
def check(name, ok, info=""):
    R["checks"].append({"name": name, "ok": bool(ok), "info": str(info)}); print(("PASS " if ok else "FAIL ") + name + (" :: " + str(info) if info else ""), flush=True)
G = "window.__PW.G"; P = "window.__PW.PW"
async def ev(pg, js): return await pg.evaluate(js)
async def shot(pg, n): await pg.screenshot(path=os.path.join(SHOTS, "v3_" + n))
HEROES = ["tank", "fighter", "mage", "marksman", "assassin", "support"]
MONS = ["slime", "rabbit", "wolf", "mushroom", "scorpion", "mummy", "yeti", "boss"]

async def newpage(b, mobile):
    if mobile: ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    else: ctx = await b.new_context(viewport={"width": 1280, "height": 720})
    pg = await ctx.new_page()
    pg.on("console", lambda m: R["errors"].append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: R["errors"].append("pageerror: " + str(e)))
    return ctx, pg

async def start(pg, hero):
    await pg.goto(BASE + "/play/?debug=1"); await pg.evaluate("localStorage.clear()"); await pg.goto(BASE + "/play/?debug=1"); await pg.wait_for_function("window.__PW_READY===true", timeout=60000)
    await pg.click(f'[data-hero="{hero}"]'); await pg.click("#t-start"); await pg.wait_for_function(G + ".running===true")
    if await pg.locator("#hint-ok").is_visible(): await pg.click("#hint-ok")

async def isolate(pg, mon, dx=70):
    """clear the field, put one immortal still monster next to the hero in town (safe zone) for clean animation checks"""
    await ev(pg, f"""(()=>{{const g={G};g.autoHunt=false;g.S.party=[];g.allies=[];g.hero.x=g.W.spawn.x;g.hero.y=g.W.spawn.y;g.monsters.forEach(m=>{{m.dead=true;m.dieT=0;m.respT=9999}});
      const m=g.monsters.find(m=>m.type==='{mon}');m.dead=false;m.hp=m.maxHp=999999;m.x=g.hero.x+{dx};m.y=g.hero.y;m.hx=m.x;m.hy=m.y;m.spd=0;m.aggro=0;m.face=Math.PI;g.hero.face=0;g.cam.x=g.hero.x+{dx//2};g.cam.y=g.hero.y-10}})()""")

async def suite(b, mobile):
    tag = "mobile" if mobile else "desktop"; ctx, pg = await newpage(b, mobile)
    await start(pg, "fighter")
    # ------------------------------------------------------------ atlas inventory
    meta = await ev(pg, f"{P}.ATLAS")
    check(f"[{tag}] atlas meta lists 6 heroines + 8 monsters/boss", len(meta) == 14 and all(f"hero_{h}" in meta for h in HEROES) and all(f"mon_{m}" in meta for m in MONS), len(meta))
    files = await ev(pg, f"""(async()=>{{const out=[];for(const k of Object.keys({P}.ATLAS)){{const r=await fetch({P}.sprUrl('atlas_'+k));out.push([k,r.status,(await r.blob()).size])}}
      for(const p of ['fox','dragon','phoenix','cloudcat','turtle','starbat'])for(const e of [1,2]){{const r=await fetch({P}.sprUrl('pet_'+p+'_e'+e));out.push(['pet_'+p+'_e'+e,r.status,0])}}
      for(const m of {json.dumps(MONS)})for(const e of [1,2]){{const r=await fetch({P}.sprUrl('tamed_'+m+'_e'+e));out.push(['tamed_'+m+'_e'+e,r.status,0])}} return out}})()""")
    check(f"[{tag}] all 14 atlases + 28 evolved sprites are served (200)", len(files) == 42 and all(s == 200 for _, s, _ in files), [f for f in files if f[1] != 200])
    big = max(x[2] for x in files if x[0].startswith(("hero_", "mon_")))
    check(f"[{tag}] atlas webp sizes are mobile-friendly (max {big//1024}KB)", 0 < big < 260 * 1024, big)
    # ------------------------------------------------------------ lazy loading
    await pg.wait_for_timeout(800)
    loaded = await ev(pg, f"Object.keys({G}.atl)")
    check(f"[{tag}] only own hero + nearby-zone atlases loaded at start", "hero_fighter" in loaded and "hero_tank" not in loaded and "mon_boss" not in loaded and len(loaded) <= 6, loaded)
    await ev(pg, f"(()=>{{const g={G};g.hero.x=1900;g.hero.y=420;g.cam.x=g.hero.x;g.cam.y=g.hero.y}})()")
    await pg.wait_for_function(f"!!{G}.atl.mon_boss&&!!{G}.atl.mon_yeti", timeout=8000)
    check(f"[{tag}] entering the ice zone lazy-loads yeti + boss atlases", True)
    # ------------------------------------------------------------ hero state machine (frames)
    await isolate(pg, "slime"); await pg.wait_for_timeout(600)
    fr = lambda: ev(pg, f"{P}.heroFrame({G}.hero,{G}.t)")
    idle = await fr(); check(f"[{tag}] hero idle state uses idle frames (11/0)", idle["s"] == "idle" and idle["f"] in (11, 0), idle)
    await ev(pg, f"{G}.hero.moving=true"); fs = set()
    for _ in range(14):
        fs.add((await fr())["f"]); await ev(pg, f"{G}.hero.moving=true"); await pg.wait_for_timeout(45)
    check(f"[{tag}] walk cycles through the 4 walk frames", fs == {0, 1, 2, 3}, sorted(fs))
    await ev(pg, f"{G}.hero.moving=false")
    await ev(pg, f"{P}.setAnim({G}.hero,'attack',0.45)"); seq = []
    for _ in range(12):
        s = await fr(); seq.append((s["s"], s["f"])); await pg.wait_for_timeout(40)
    af = [f for s, f in seq if s == "attack"]
    check(f"[{tag}] attack plays frames 4→5→6 then returns to idle", set(af) == {4, 5, 6} and af == sorted(af) and seq[-1][0] != "attack", seq)
    await ev(pg, f"{P}.setAnim({G}.hero,'cast',0.45)"); seq = []
    for _ in range(12):
        s = await fr(); seq.append((s["s"], s["f"])); await pg.wait_for_timeout(40)
    cf = [f for s, f in seq if s == "cast"]; check(f"[{tag}] cast plays frames 8→9→10", set(cf) == {8, 9, 10} and cf == sorted(cf), seq)
    await ev(pg, f"{G}.hero.hurt=0.15"); h = await fr(); check(f"[{tag}] hurt frame (7) while hit", h["f"] == 7 and h["s"] == "hurt", h)
    await ev(pg, f"{G}.hero.hurt=0")
    # real combat triggers the animation + real damage still works
    await ev(pg, f"(()=>{{const g={G};g.hero.atkT=0;g.hero.cds[0]=0;{P}.basicAttack(g.hero,g.monsters.find(m=>m.type==='slime'&&!m.dead))}})()")
    check(f"[{tag}] basicAttack() starts the attack animation", (await ev(pg, f"{G}.hero.an&&{G}.hero.an.k")) == "attack")
    await ev(pg, f"(()=>{{const g={G};g.hero.mp=g.hero.maxMp;g.hero.cds[1]=0;{P}.castSkill(g.hero,1)}})()")
    check(f"[{tag}] castSkill() starts the cast animation", (await ev(pg, f"{G}.hero.an&&{G}.hero.an.k")) == "cast")
    # monster state machine
    m0 = await ev(pg, f"(()=>{{const m={G}.monsters.find(m=>m.type==='slime'&&!m.dead);{P}.setAnim(m,'attack',0.4);return {P}.monFrame(m,{G}.t,false)}})()")
    check(f"[{tag}] monster attack animation frames 4-6", m0["s"] == "attack" and 4 <= m0["f"] <= 6, m0)
    mw = await ev(pg, f"(()=>{{const m={G}.monsters.find(m=>m.type==='slime'&&!m.dead);m.an=null;m.hurt=0;return [{P}.monFrame(m,0.1,true).s,{P}.monFrame(m,0.1,false).s]}})()")
    check(f"[{tag}] monster walk / idle states", mw == ["walk", "idle"], mw)
    # every heroine renders from her own atlas (drawFrame returns true) + all frames non-empty
    res = await ev(pg, f"""(async()=>{{const out={{}};const cv=document.createElement('canvas');cv.width=cv.height=200;const c=cv.getContext('2d');
      for(const h of {json.dumps(HEROES)}){{await {P}.loadAtlas('hero_'+h);let ok=true;for(let f=0;f<12;f++){{c.clearRect(0,0,200,200);ok=ok&&{P}.drawFrame(c,'hero_'+h,f,100,180,120,false);const d=c.getImageData(0,0,200,200).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>20)n++;if(n<300)ok=false}}out[h]=ok}}
      for(const m of {json.dumps(MONS)}){{await {P}.loadAtlas('mon_'+m);let ok=true;for(let f=0;f<8;f++){{c.clearRect(0,0,200,200);ok=ok&&{P}.drawFrame(c,'mon_'+m,f,100,180,100,false);const d=c.getImageData(0,0,200,200).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>20)n++;if(n<150)ok=false}}out[m]=ok}}return out}})()""")
    check(f"[{tag}] all 12 hero frames x6 and 8 monster frames x8 draw non-empty", all(res.values()) and len(res) == 14, {k: v for k, v in res.items() if not v})
    await ev(pg, f"{P}.setAnim({G}.hero,'attack',0.45)"); await pg.wait_for_timeout(120); await shot(pg, f"{tag}_anim_attack.png")
    # ------------------------------------------------------------ evolved pet art
    await ev(pg, f"Object.assign({G}.S,{{eggs:3,gems:9}})"); keys = {}
    for sp in ["fox", "dragon", "phoenix", "cloudcat", "turtle", "starbat"]:
        await ev(pg, f"(()=>{{const p={P}.addComp('pet','{sp}',20);p.evo=0}})()")
    for mn in ["slime", "wolf"]: await ev(pg, f"{P}.addComp('minion','{mn}',20)")
    ck = await ev(pg, f"""(async()=>{{const out=[];for(const p of {G}.S.pets){{const k0={P}.compSprite(p);p.evo=1;const k1={P}.compSprite(p);p.evo=2;const k2={P}.compSprite(p);p.evo=0;
      const a=await {P}.loadSpr(k1),b=await {P}.loadSpr(k2);out.push([k0,k1,k2,!!a&&a.width>50,!!b&&b.width>50])}}return out}})()""")
    check(f"[{tag}] evolved stages use their own sprite key (…_e1/…_e2) and the images load", all(a[1] == a[0] + "_e1" and a[2] == a[0] + "_e2" and a[3] and a[4] for a in ck) and len(ck) == 8, ck[:2])
    same = await ev(pg, f"""(async()=>{{const S={G}.spr;const hs=[];for(const k of ['pet_dragon','pet_dragon_e1','pet_dragon_e2']){{await {P}.loadSpr(k);const im=S[k];const c=document.createElement('canvas');c.width=c.height=16;const g=c.getContext('2d');g.drawImage(im,0,0,16,16);hs.push(Array.from(g.getImageData(0,0,16,16).data).join(',').length+':'+Array.from(g.getImageData(0,0,16,16).data).reduce((a,b)=>a+b,0))}}return hs}})()""")
    check(f"[{tag}] evolved art differs from the base art (not a scaled reuse)", len(set(same)) == 3, same)
    await ev(pg, f"(()=>{{const S={G}.S;S.pets.forEach((p,i)=>p.evo=i%3);S.petOn=S.pets[1].uid;S.minionOn=S.pets[6].uid;{P}.syncComps()}})()")
    await ev(pg, f"(()=>{{const g={G};g.hero.x=g.W.spawn.x;g.hero.y=g.W.spawn.y;g.cam.x=g.hero.x;g.cam.y=g.hero.y}})()")
    await pg.wait_for_timeout(900); await shot(pg, f"{tag}_evolved_pets_world.png")
    await pg.click("#hb-pet"); await pg.wait_for_selector(".pet"); await shot(pg, f"{tag}_evolved_pets_panel.png")
    await pg.click('[data-act="close"]')
    # ------------------------------------------------------------ audio
    await pg.mouse.click(5, 5) if not mobile else await pg.touchscreen.tap(5, 5)
    await ev(pg, f"{P}.audioUnlock()"); await pg.wait_for_timeout(1800); ai = await ev(pg, f"{P}.audioInfo()")
    check(f"[{tag}] WebAudio unlocked + music sequencer scheduling notes", ai["ready"] and ai["notes"] > 5 and ai["track"] in ("town", "meadow"), ai)
    bad = await ev(pg, f"""(()=>{{const bad=[];for(const k of ['hit','crit','hurt','down','swing','arrow','magic','skill','ult','coin','loot','level','pot','click','open','pop','boss','capture','evolve','zone','step','nonexistent']){{try{{{P}.sfx(k)}}catch(e){{bad.push(k)}}}}return bad}})()""")
    check(f"[{tag}] all sound effects play without throwing", not bad, bad)
    tr = set()
    for zone, x, y in [("forest", 1500, 1500), ("desert", 2300, 900), ("ice", 1900, 420)]:
        await ev(pg, f"(()=>{{const g={G};g.hero.x={x};g.hero.y={y};g.cam.x=g.hero.x;g.cam.y=g.hero.y}})()")
        try: await pg.wait_for_function(f"{P}.audioInfo().track==='{zone}'", timeout=4000); tr.add(zone)
        except Exception: pass
    check(f"[{tag}] music follows zones (forest / desert / ice themes)", tr == {"forest", "desert", "ice"}, sorted(tr))
    await ev(pg, f"(()=>{{const g={G};const b=g.monsters.find(m=>m.type==='boss');b.dead=false;b.x=g.hero.x+120;b.y=g.hero.y}})()")
    try: await pg.wait_for_function(f"{P}.audioInfo().track==='boss'", timeout=4000); okb = True
    except Exception: okb = False
    check(f"[{tag}] boss theme starts when the boss is near", okb)
    # ------------------------------------------------------------ transitions
    await ev(pg, f"(()=>{{const g={G};g.hero.x=g.W.spawn.x;g.hero.y=g.W.spawn.y}})()"); await pg.wait_for_timeout(300)
    await ev(pg, f"(()=>{{const g={G};g.hero.x=300;g.hero.y=700;}})()"); await pg.wait_for_timeout(180)
    op = await ev(pg, "+getComputedStyle(document.getElementById('fade')).opacity"); await pg.wait_for_timeout(1500)
    op2 = await ev(pg, "+getComputedStyle(document.getElementById('fade')).opacity")
    check(f"[{tag}] zone change plays a fade transition then clears", op > 0.05 and op2 < 0.02, f"{op:.2f}->{op2:.2f}")
    # ------------------------------------------------------------ settings panel
    await pg.click("#hb-set"); await pg.wait_for_selector("#set-music"); await pg.wait_for_timeout(350)
    sm = await ev(pg, "[document.getElementById('set-music').value,document.getElementById('set-sfx').value,document.getElementById('set-quality').value]")
    check(f"[{tag}] settings panel opens (music {sm[0]}%, sfx {sm[1]}%, quality {sm[2]})", sm == ["50", "80", "auto"], sm); await shot(pg, f"{tag}_settings.png")
    await ev(pg, "(()=>{const e=document.getElementById('set-music');e.value=20;e.dispatchEvent(new Event('input',{bubbles:true}))})()")
    await ev(pg, "(()=>{const e=document.getElementById('set-sfx');e.value=35;e.dispatchEvent(new Event('input',{bubbles:true}))})()")
    ai = await ev(pg, f"{P}.audioInfo()"); check(f"[{tag}] volume sliders change music/sfx levels", abs(ai["music"] - 0.2) < 0.01 and abs(ai["sfx"] - 0.35) < 0.01, ai)
    w0 = await ev(pg, "document.getElementById('game').width")
    await pg.select_option("#set-quality", "low"); q = await ev(pg, f"[{P}.quality(),{P}.pcap,document.getElementById('game').width,window.innerWidth]")
    check(f"[{tag}] low graphics: quality=low, particle cap 140, canvas ≤1x DPR", q[0] == "low" and q[1] == 140 and q[2] <= q[3] + 2, q)
    await pg.select_option("#set-quality", "high"); q2 = await ev(pg, f"[{P}.quality(),{P}.pcap,document.getElementById('game').width]")
    check(f"[{tag}] high graphics restores caps", q2[0] == "high" and q2[1] == 420 and q2[2] >= q[2], q2)
    await pg.select_option("#set-quality", "low"); await pg.click('[data-act="close"]')
    await pg.wait_for_timeout(500); await shot(pg, f"{tag}_lowgfx_world.png")
    sv = await ev(pg, "JSON.parse(localStorage.getItem(window.__PW.PW.SAVE_KEY)).settings")
    check(f"[{tag}] settings persisted in the save (music 20, sfx 35, quality low)", sv["musicVol"] == 20 and sv["sfxVol"] == 35 and sv["quality"] == "low", sv)
    await pg.reload(); await pg.wait_for_function("window.__PW_READY===true", timeout=60000); await pg.click("#t-continue") if await pg.locator("#t-continue").is_visible() else None
    await pg.wait_for_function(G + ".running===true"); await pg.wait_for_timeout(500)
    st = await ev(pg, f"[{G}.S.settings.musicVol,{G}.S.settings.quality,{P}.quality()]")
    check(f"[{tag}] settings survive a reload", st == [20, "low", "low"], st)
    # master mute toggle
    await ev(pg, f"{G}.S.settings.sound=false;{P}.audioApplyVol()"); check(f"[{tag}] sound toggle mutes audio", (await ev(pg, f"{P}.audioInfo()"))["on"] is False)
    await ev(pg, f"{G}.S.settings.sound=true;{G}.S.settings.quality='high';{P}.applyQuality()")
    # ------------------------------------------------------------ all 6 heroines in-game (mobile only screenshots)
    if mobile:
        for h in HEROES:
            await start(pg, h); await isolate(pg, "slime"); await pg.wait_for_timeout(500)
            await ev(pg, f"{P}.setAnim({G}.hero,'cast',0.6)"); await pg.wait_for_timeout(180)
            ok = await ev(pg, f"!!{G}.atl.hero_{h}"); check(f"[{tag}] {h}: own atlas loaded and in use", ok)
    await ctx.close()

async def video(b):
    ctx, pg = await newpage(b, False); await ctx.close()
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True); pg = await ctx.new_page()
    await start(pg, "assassin"); await isolate(pg, "wolf", 60); await ev(pg, f"{G}.cam.y={G}.hero.y-6"); await pg.wait_for_timeout(1500)
    tmp = os.path.join(SHOTS, "_frames"); os.makedirs(tmp, exist_ok=True)
    for f in os.listdir(tmp): os.remove(os.path.join(tmp, f))
    clip = {"x": 75, "y": 318, "width": 240, "height": 180}; n = 0
    async def grab(k):
        nonlocal n
        for _ in range(k): await pg.screenshot(path=os.path.join(tmp, f"f{n:04d}.png"), clip=clip); n += 1
    await grab(8)
    await ev(pg, f"{G}.hero.moving=true"); 
    for _ in range(12): await ev(pg, f"{G}.hero.moving=true"); await grab(1)
    await ev(pg, f"{G}.hero.moving=false")
    for k in range(3):
        await ev(pg, f"(()=>{{const g={G};{P}.setAnim(g.hero,'attack',0.45);{P}.setAnim(g.monsters.find(m=>m.type==='wolf'&&!m.dead),'attack',0.45)}})()"); await grab(7)
    await ev(pg, f"{P}.setAnim({G}.hero,'cast',0.7)"); await grab(8)
    await ev(pg, f"(()=>{{const g={G};g.hero.hurt=0.2;g.monsters.find(m=>m.type==='wolf'&&!m.dead).hurt=0.12}})()"); await grab(5)
    await ctx.close(); mp4 = os.path.join(SHOTS, "v3_anim.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", "9", "-i", os.path.join(tmp, "f%04d.png"), "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-pix_fmt", "yuv420p", mp4], check=True)
    for f in os.listdir(tmp): os.remove(os.path.join(tmp, f))
    os.rmdir(tmp); print("video:", mp4, n, "frames")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**launch_opts(["--autoplay-policy=no-user-gesture-required"]))
        await suite(b, True); await suite(b, False)
        if VIDEO: await video(b)
        await b.close()
    check("no console errors / page errors", not R["errors"], R["errors"][:5])
    ok = sum(c["ok"] for c in R["checks"]); print(f"\n{ok}/{len(R['checks'])} checks passed")
    json.dump(R, open(os.path.join(SHOTS, "v3-results.json"), "w"), indent=1)
    sys.exit(0 if ok == len(R["checks"]) else 1)
asyncio.run(main())
