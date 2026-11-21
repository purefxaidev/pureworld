"""PureWorld controls test: verifies the heroine actually moves for EVERY input method.
Usage: python3 tests/controls.py [BASE_URL]   (default http://127.0.0.1:8080, or $BASE_URL)
Mobile profiles use real CDP touch events (Input.dispatchTouchEvent) on iPhone- and Android-sized viewports;
desktop uses real keyboard (incl. Thai keyboard layout), mouse click-to-move, mouse drag and click-to-attack."""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
from _browser import launch_opts, base_url

BASE = base_url(sys.argv)
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "screens"); os.makedirs(SHOTS, exist_ok=True)
R = {"checks": [], "errors": []}
def check(name, ok, info=""):
    R["checks"].append({"name": name, "ok": bool(ok), "info": str(info)}); print(("PASS " if ok else "FAIL ") + name + (" :: " + str(info) if info else ""), flush=True)

IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
AND_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36"
PROFILES = [
    ("iphone", dict(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True, user_agent=IOS_UA)),
    ("android", dict(viewport={"width": 412, "height": 915}, device_scale_factor=2.625, is_mobile=True, has_touch=True, user_agent=AND_UA)),
    ("android-landscape", dict(viewport={"width": 915, "height": 412}, device_scale_factor=2.625, is_mobile=True, has_touch=True, user_agent=AND_UA)),
    ("desktop", dict(viewport={"width": 1280, "height": 800})),
]

async def ev(pg, js): return await pg.evaluate(js)
HERO = "(()=>{const h=window.__PW.G.hero;return [h.x,h.y]})()"
RESET = """(()=>{const g=window.__PW.G;g.moveTo=null;g.autoHunt=false;g.input.x=0;g.input.y=0;const s=g.W.spawn;g.hero.x=s.x;g.hero.y=s.y;g.hero.hp=g.hero.maxHp;g.cam.x=s.x;g.cam.y=s.y;})()"""

async def start(b, prof):
    ctx = await b.new_context(**prof); pg = await ctx.new_page()
    pg.on("console", lambda m: R["errors"].append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: R["errors"].append("pageerror: " + str(e)))
    await pg.goto(BASE + "/play/?debug=1"); await pg.wait_for_function("window.__PW_READY===true", timeout=60000)
    await pg.click('[data-hero="fighter"]'); await pg.click("#t-start"); await pg.wait_for_function("window.__PW.G.running===true")
    await pg.wait_for_timeout(600)
    return ctx, pg

async def moved(pg, act, tag, name, axis=0, sign=1, min_d=24):
    await ev(pg, RESET); await pg.wait_for_timeout(250)
    p0 = await ev(pg, HERO); await act(); p1 = await ev(pg, HERO)
    d = (p1[axis] - p0[axis]) * sign
    check(f"[{tag}] {name}", d > min_d, f"({p0[0]:.0f},{p0[1]:.0f})->({p1[0]:.0f},{p1[1]:.0f})")

async def touch_drag(cdp, pg, x0, y0, x1, y1, hold=800):
    tp = lambda x, y: [{"x": x, "y": y, "id": 1, "radiusX": 8, "radiusY": 8, "force": 1}]
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": tp(x0, y0)})
    for i in range(1, 7):
        await cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": tp(x0 + (x1 - x0) * i / 6, y0 + (y1 - y0) * i / 6)}); await pg.wait_for_timeout(16)
    await pg.wait_for_timeout(hold)
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})

async def touch_tap(cdp, x, y):
    tp = [{"x": x, "y": y, "id": 2, "radiusX": 6, "radiusY": 6, "force": 1}]
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": tp})
    await cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})

async def run_mobile(b, tag, prof):
    ctx, pg = await start(b, prof); cdp = await ctx.new_cdp_session(pg)
    hint = await pg.locator("#hint").is_visible(); check(f"[{tag}] controls hint shown on first play", hint)
    joy = await pg.locator("#joy").bounding_box(); check(f"[{tag}] joystick visible bottom-left", joy and joy["x"] < 60 and joy["y"] > prof["viewport"]["height"] * 0.55, joy)
    await shot(pg, f"v2_{tag}_hint.png")
    # dismiss hint by touching the joystick directly (first input must work even with the hint up)
    jx, jy = joy["x"] + joy["width"] / 2, joy["y"] + joy["height"] / 2
    await moved(pg, lambda: touch_drag(cdp, pg, jx, jy, jx + 50, jy), tag, "CDP touch joystick → right", 0, 1)
    check(f"[{tag}] hint dismissed after first move", not await pg.locator("#hint").is_visible())
    await moved(pg, lambda: touch_drag(cdp, pg, jx, jy, jx, jy + 50), tag, "CDP touch joystick → down", 1, 1)
    await moved(pg, lambda: touch_drag(cdp, pg, jx, jy, jx - 50, jy), tag, "CDP touch joystick → left", 0, -1)
    # touch anywhere lower-left re-centres the stick
    vw, vh = prof["viewport"]["width"], prof["viewport"]["height"]
    await moved(pg, lambda: touch_drag(cdp, pg, vw * 0.3, vh * 0.62, vw * 0.3 + 50, vh * 0.62), tag, "touch lower-left area (floating joystick) → right", 0, 1)
    # drag anywhere on the map = floating stick
    await moved(pg, lambda: touch_drag(cdp, pg, vw * 0.55, vh * 0.35, vw * 0.55, vh * 0.35 + 60), tag, "drag on map → down", 1, 1)
    # tap-to-move
    async def tapmove():
        s = await ev(pg, "(()=>{const h=window.__PW.G.hero;return window.__PW.PW.worldToScreen(h.x+110,h.y+20)})()")
        await touch_tap(cdp, s["x"], s["y"]); await pg.wait_for_timeout(1200)
    await moved(pg, tapmove, tag, "tap ground → walks there", 0, 1, 40)
    # NPC tap → walk & talk
    await ev(pg, RESET)
    s = await ev(pg, "(()=>{const g=window.__PW.G,n=g.npcs.find(n=>n.id==='mali');g.hero.x=n.x+150;g.hero.y=n.y+40;g.cam.x=g.hero.x;g.cam.y=g.hero.y;return 1})()")
    await pg.wait_for_timeout(200)
    s = await ev(pg, "(()=>{const g=window.__PW.G,n=g.npcs.find(n=>n.id==='mali');return window.__PW.PW.worldToScreen(n.x,n.y-30)})()")
    await touch_tap(cdp, s["x"], s["y"])
    try: await pg.wait_for_selector("#chat-log", timeout=6000); ok = True
    except Exception: ok = False
    check(f"[{tag}] tap NPC → walks over and opens chat", ok)
    if ok: await pg.click('[data-act="close"]')
    # pointer-events / z-index sanity: element at joystick centre is the joystick
    top = await ev(pg, f"(()=>{{const e=document.elementFromPoint({jx},{jy});return e&&e.closest('#joy')?'joy':(e&&e.id)}})()")
    check(f"[{tag}] nothing overlays the joystick", top == "joy", top)
    await ev(pg, RESET); await pg.wait_for_timeout(400); await shot(pg, f"v2_{tag}_game.png")
    await ctx.close()

async def run_desktop(b, tag, prof):
    ctx, pg = await start(b, prof)
    joy = await pg.locator("#joy").is_visible(); check(f"[{tag}] joystick visible on desktop too", joy)
    await pg.click("#hint-ok")
    async def key(k, ms=700):
        await pg.keyboard.down(k); await pg.wait_for_timeout(ms); await pg.keyboard.up(k)
    await moved(pg, lambda: key("d"), tag, "keyboard D → right", 0, 1)
    await moved(pg, lambda: key("ArrowLeft"), tag, "keyboard ← → left", 0, -1)
    await moved(pg, lambda: key("s"), tag, "keyboard S → down", 1, 1)
    async def thai():  # Thai layout: physical D key produces e.key "ก" but e.code "KeyD"
        await ev(pg, "window.dispatchEvent(new KeyboardEvent('keydown',{key:'ก',code:'KeyD'}))"); await pg.wait_for_timeout(700)
        await ev(pg, "window.dispatchEvent(new KeyboardEvent('keyup',{key:'ก',code:'KeyD'}))")
    await moved(pg, thai, tag, "Thai keyboard layout (key 'ก', code KeyD) → right", 0, 1)
    async def click_move():
        s = await ev(pg, "(()=>{const h=window.__PW.G.hero;return window.__PW.PW.worldToScreen(h.x-120,h.y+30)})()")
        await pg.mouse.click(s["x"], s["y"]); await pg.wait_for_timeout(1300)
    await moved(pg, click_move, tag, "mouse click ground → walks there", 0, -1, 40)
    async def drag():
        await pg.mouse.move(700, 300); await pg.mouse.down(); await pg.mouse.move(760, 300, steps=6); await pg.wait_for_timeout(700); await pg.mouse.up()
    await moved(pg, drag, tag, "mouse drag on map → right", 0, 1)
    # click a monster → walk to it & attack
    await ev(pg, "(()=>{const g=window.__PW.G;const m=g.monsters.find(m=>m.type==='slime'&&!m.dead);g.hero.x=m.x-150;g.hero.y=m.y;g.cam.x=g.hero.x;g.cam.y=g.hero.y;window.__tm=m;})()")
    await pg.wait_for_timeout(150)
    s = await ev(pg, "(()=>{const m=window.__tm;return window.__PW.PW.worldToScreen(m.x,m.y-m.r)})()")
    await ev(pg, "(()=>{const m=window.__tm;m.__dmg=0;const P=window.__PW.PW;const k0=window.__PW.G.S.kills;window.__k0=k0;})()")
    hp0 = await ev(pg, "window.__tm.hp"); await pg.mouse.click(s["x"], s["y"])
    mt = await ev(pg, "!!(window.__PW.G.moveTo&&window.__PW.G.moveTo.m===window.__tm)")
    await pg.wait_for_timeout(1500)
    hp1, kd = await ev(pg, "[window.__tm.dead?0:window.__tm.hp, window.__PW.G.S.kills-window.__k0]")
    check(f"[{tag}] click monster → targets, walks over and attacks", mt and (hp1 < hp0 or kd > 0), f"target={mt} hp {hp0:.0f}->{hp1:.0f} kills+{kd}")
    await ev(pg, RESET); await pg.wait_for_timeout(400); await shot(pg, f"v2_{tag}_game.png")
    await ctx.close()

async def shot(pg, n): await pg.screenshot(path=os.path.join(SHOTS, n))

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**launch_opts())
        for tag, prof in PROFILES:
            await (run_desktop if tag == "desktop" else run_mobile)(b, tag, prof)
        await b.close()
    check("no console errors / page errors", not R["errors"], R["errors"][:5])
    json.dump(R, open(os.path.join(SHOTS, "controls-results.json"), "w"), ensure_ascii=False, indent=2)
    bad = [c for c in R["checks"] if not c["ok"]]; print(f"\n{len(R['checks'])-len(bad)}/{len(R['checks'])} checks passed"); sys.exit(1 if bad else 0)
asyncio.run(main())
