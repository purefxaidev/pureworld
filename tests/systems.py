"""PureWorld v2 systems test: skill upgrades/passive/ultimate, pets (hatch/equip/feed/evolve/follow),
monster capture -> minion + collection book, shop extras, AUTO farm (XP/level with zero input, auto potion,
manual override then resume, auto-revive). Usage: python3 tests/systems.py [BASE_URL]"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _browser import launch_opts, base_url

BASE = base_url(sys.argv)
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "screens"); os.makedirs(SHOTS, exist_ok=True)
R = {"checks": [], "errors": []}
def check(name, ok, info=""):
    R["checks"].append({"name": name, "ok": bool(ok), "info": str(info)}); print(("PASS " if ok else "FAIL ") + name + (" :: " + str(info) if info else ""), flush=True)
async def ev(pg, js): return await pg.evaluate(js)
async def shot(pg, n): await pg.screenshot(path=os.path.join(SHOTS, n))
G = "window.__PW.G"; P = "window.__PW.PW"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**launch_opts())
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page()
        pg.on("console", lambda m: R["errors"].append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: R["errors"].append("pageerror: " + str(e)))
        await pg.goto(BASE + "/play/?debug=1"); await pg.wait_for_function("window.__PW_READY===true", timeout=60000)
        await pg.click('[data-hero="mage"]'); await pg.click("#t-start"); await pg.wait_for_function(G + ".running===true"); await pg.click("#hint-ok")

        # ---------- skill points + upgrades
        sp0 = await ev(pg, G + ".S.sp")
        await ev(pg, f"(()=>{{let n=0;while({G}.hero.level<12&&n++<400){P}.gainXp(60)}})()")
        lv, sp1 = await ev(pg, f"[{G}.hero.level,{G}.S.sp]")
        check("level-ups grant skill points", lv >= 10 and sp1 >= sp0 + lv - 1, f"Lv{lv} sp {sp0}->{sp1}")
        await ev(pg, f"{G}.S.sp=12")
        await pg.click("#hb-skill"); await pg.wait_for_selector('[data-act="sk-up"]'); await shot(pg, "v2_skills_panel.png")
        await ev(pg, f"{G}.hero.cds[0]=0"); await ev(pg, f"{G}.hero.mp={G}.hero.maxMp")
        await pg.click('[data-act="sk-up"][data-v="0"]'); await pg.click('[data-act="sk-up"][data-v="0"]')
        skl = await ev(pg, f"{G}.S.skl[0]"); check("upgrade skill 1 twice (Lv1→3)", skl == 3, skl)
        await pg.click('[data-act="sk-pass"]'); check("unlock passive", await ev(pg, f"{G}.S.passive") is True)
        await pg.click('[data-act="sk-ult"]'); check("unlock ultimate", await ev(pg, f"{G}.S.ult") == 1)
        await pg.click('[data-act="close"]')
        check("ultimate button appears", await pg.locator("#btn-ult").is_visible())
        await ev(pg, f"(()=>{{const g={G};const m=g.monsters.find(m=>m.type==='slime'&&!m.dead);g.hero.x=m.x-60;g.hero.y=m.y;g.cam.x=g.hero.x;g.cam.y=g.hero.y;g.hero.mp=g.hero.maxMp;g.hero.cds[0]=0}})()")
        await pg.wait_for_timeout(200)
        await ev(pg, f"{P}.castSkill({G}.hero,0)"); cd = await ev(pg, f"{G}.hero.cds[0]"); base = await ev(pg, f"{P}.HEROES.mage.skills[0].cd")
        check("upgraded skill has shorter cooldown", cd < base, f"{cd:.2f} < {base}")
        await pg.tap("#btn-ult"); await pg.wait_for_timeout(300); check("cast ultimate (cooldown starts)", await ev(pg, f"{G}.hero.ultCd") > 0)
        await pg.wait_for_timeout(500); await shot(pg, "v2_ultimate.png")

        # ---------- pets
        await ev(pg, f"Object.assign({G}.S,{{eggs:2,treats:5,gems:3}})")
        await pg.click("#hb-pet"); await pg.click('[data-act="hatch"]')
        n, on = await ev(pg, f"[{G}.S.pets.length,{G}.S.petOn]"); check("hatch egg → pet, auto-equipped", n == 1 and on, f"pets={n} on={on}")
        uid = on; lv0 = await ev(pg, f"{G}.S.pets[0].lv")
        for _ in range(3): await pg.click(f'[data-act="pet-feed"][data-v="{uid}"]')
        lv1 = await ev(pg, f"{G}.S.pets[0].lv"); check("feed treats → pet levels up", lv1 > lv0, f"Lv{lv0}->{lv1}")
        await ev(pg, f"{G}.S.pets[0].lv=10"); await pg.click('[data-act="pet-tab"][data-v="pet"]'); await pg.click(f'[data-act="pet-evo"][data-v="{uid}"]')
        check("evolve pet at Lv10 with gem", await ev(pg, f"{G}.S.pets[0].evo") == 1)
        await shot(pg, "v2_pets_panel.png"); await pg.click('[data-act="close"]')
        atkB = await ev(pg, f"{P}.bonus()"); check("active pet gives stat bonus", len(atkB) > 0, atkB)
        await pg.wait_for_timeout(1500)
        d = await ev(pg, f"(()=>{{const g={G},c=g.comps.find(c=>c.p.kind==='pet');return c?Math.hypot(c.x-g.hero.x,c.y-g.hero.y):-1}})()")
        check("pet follows the player", 0 <= d < 140, f"dist={d:.0f}")

        # ---------- capture
        await ev(pg, f"{G}.S.settings.autoAtk=false"); cr0 = await ev(pg, f"{G}.S.crystals")
        await ev(pg, f"(()=>{{const g={G};const m=g.monsters.find(m=>m.type==='rabbit'&&!m.dead)||g.monsters.find(m=>!m.dead&&!{P}.MONSTERS[m.type].boss);g.hero.x=m.x-80;g.hero.y=m.y;g.cam.x=g.hero.x;g.cam.y=g.hero.y;m.hp=Math.max(1,m.maxHp*0.3);window.__cm=m;{P}.captureRoll=()=>1;{G}.comps.forEach(c=>c.atkT=99);}})()")
        await pg.wait_for_timeout(300)
        ch = await pg.inner_text("#cap-p"); check("capture chance shown for low-HP target", "%" in ch, ch)
        await pg.tap("#btn-cap"); await pg.wait_for_timeout(900)
        check("failed capture consumes crystal + counts fail", await ev(pg, f"[{G}.S.crystals,{G}.S.capFail]") == [cr0 - 1, 1])
        await ev(pg, f"(()=>{{const m=window.__cm;m.hp=Math.max(1,m.maxHp*0.3);{P}.captureRoll=()=>0;{G}.comps.forEach(c=>c.atkT=99);}})()")
        await pg.tap("#btn-cap"); await pg.wait_for_timeout(250); await shot(pg, "v2_capture.png"); await pg.wait_for_timeout(700)
        mins, typ, book = await ev(pg, f"[{G}.S.pets.filter(p=>p.kind==='minion').length, window.__cm.type, {G}.S.book]")
        check("successful capture → minion + book entry", mins == 1 and book.get("mon_" + typ), f"minions={mins} book={list(book)}")
        check("minion auto-equipped as companion", await ev(pg, f"!!{G}.S.minionOn && {G}.comps.length===2"))
        await ev(pg, f"{P}.captureRoll=()=>Math.random();{G}.S.settings.autoAtk=true")
        await pg.click("#hb-book"); await pg.wait_for_selector(".bk.got"); got = await pg.locator(".bk.got").count()
        check("collection book shows caught entries", got >= 2, got); await shot(pg, "v2_book.png"); await pg.click('[data-act="close"]')

        # ---------- shop extras
        await ev(pg, f"(()=>{{const g={G};g.S.gold=2000;const n=g.npcs.find(n=>n.id==='prom');g.hero.x=n.x;g.hero.y=n.y+10;}})()"); await pg.wait_for_timeout(400)
        await pg.click("#btn-talk"); await pg.click('[data-act="shop"]'); c0 = await ev(pg, f"{G}.S.crystals")
        await pg.click('[data-act="buyx"][data-t="crystal"][data-n="5"]'); c1 = await ev(pg, f"{G}.S.crystals")
        check("buy capture crystals x5 at shop", c1 == c0 + 5, f"{c0}->{c1}"); await shot(pg, "v2_shop.png"); await pg.click('[data-act="close"]')
        await ctx.close()

        # ---------- AUTO farm on a fresh character, zero input
        ctx = await b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page()
        pg.on("console", lambda m: R["errors"].append(m.text) if m.type == "error" else None); pg.on("pageerror", lambda e: R["errors"].append("pageerror: " + str(e)))
        await pg.goto(BASE + "/play/?debug=1"); await pg.wait_for_function("window.__PW_READY===true", timeout=60000)
        await pg.click('[data-hero="marksman"]'); await pg.click("#t-start"); await pg.wait_for_function(G + ".running===true"); await pg.click("#hint-ok")
        await pg.tap("#btn-auto")
        check("AUTO indicator visible", await pg.locator("#auto-ind").is_visible())
        lv0, xp0 = await ev(pg, f"[{G}.hero.level,{G}.hero.xp]"); t = 0; shotd = False
        while t < 120:
            await pg.wait_for_timeout(2000); t += 2
            k, lv = await ev(pg, f"[{G}.S.kills,{G}.hero.level]")
            if k >= 1 and not shotd: await shot(pg, "v2_auto_fight.png"); shotd = True
            if lv >= lv0 + 2: break
        k, lv, xp = await ev(pg, f"[{G}.S.kills,{G}.hero.level,{G}.hero.xp]")
        check("AUTO: kills + XP/level gain with zero input", k >= 3 and lv > lv0, f"{t}s kills={k} Lv{lv0}->{lv}")
        # auto potion
        drank = False; hp0 = await ev(pg, f"{G}.S.hpPot")
        for _ in range(4):  # (a level-up mid-wait refills HP, so retry a few times)
            await ev(pg, f"(()=>{{const h={G}.hero;h.hp=h.maxHp*0.2}})()"); await pg.wait_for_timeout(1500)
            if await ev(pg, f"{G}.S.hpPot") < hp0: drank = True; break
        check("AUTO drinks potion below HP threshold", drank)
        # manual override then resume
        await ev(pg, f"{G}.hero.hp={G}.hero.maxHp")
        x0 = await ev(pg, f"{G}.hero.x")
        await ev(pg, f"(()=>{{{G}.input.x=1;{G}.input.y=0}})()"); await pg.wait_for_timeout(500); await ev(pg, f"(()=>{{{G}.input.x=0;{G}.input.y=0}})()")
        x1 = await ev(pg, f"{G}.hero.x"); check("manual input overrides AUTO", x1 > x0 + 30 and await ev(pg, f"{G}.autoHunt"), f"{x0:.0f}->{x1:.0f}")
        k0 = await ev(pg, f"{G}.S.kills"); await pg.wait_for_timeout(12000)
        check("AUTO resumes after manual input", await ev(pg, f"{G}.S.kills") > k0)
        # death → auto revive → keeps farming
        await ev(pg, f"(()=>{{const h={G}.hero;h.hp=0;h.dead=true;{P}.onPlayerDead();}})()"); await pg.wait_for_timeout(500)
        check("death panel shows auto-revive countdown", await pg.locator("#rv-n").is_visible()); await pg.wait_for_timeout(6000)
        check("auto-revived and AUTO still on", await ev(pg, f"!{G}.hero.dead && {G}.autoHunt && !{G}.panel"))
        await ctx.close(); await b.close()
    check("no console errors / page errors", not R["errors"], R["errors"][:5])
    json.dump(R, open(os.path.join(SHOTS, "systems-results.json"), "w"), ensure_ascii=False, indent=2)
    bad = [c for c in R["checks"] if not c["ok"]]; print(f"\n{len(R['checks'])-len(bad)}/{len(R['checks'])} checks passed"); sys.exit(1 if bad else 0)
asyncio.run(main())
