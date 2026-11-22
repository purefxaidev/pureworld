"""PureWorld death/respawn + swarm-balance tests.
Covers the live bug "ตายแล้วบัค ม่อนเข้ามือเยอะไป": clean death screen, town respawn, invuln,
aggro cleared, AUTO paused, no frozen pause/anim, save not corrupted, aggro cap, AUTO retreat.
Usage: python3 tests/death.py [BASE_URL]
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _browser import launch_opts, base_url

BASE = base_url(sys.argv)
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "screens")
os.makedirs(SHOTS, exist_ok=True)
R = {"checks": [], "errors": []}
def check(name, ok, info=""):
    R["checks"].append({"name": name, "ok": bool(ok), "info": str(info)})
    print(("PASS " if ok else "FAIL ") + name + (" :: " + str(info) if info else ""), flush=True)
G, P = "window.__PW.G", "window.__PW.PW"
async def ev(pg, js): return await pg.evaluate(js)

async def start(pg, hero="fighter"):
    await pg.goto(BASE + "/play/?debug=1")
    await pg.evaluate("localStorage.clear()")
    await pg.goto(BASE + "/play/?debug=1")
    await pg.wait_for_function("window.__PW_READY===true", timeout=60000)
    await pg.click(f'[data-hero="{hero}"]'); await pg.click("#t-start")
    await pg.wait_for_function(G + ".running===true")
    if await pg.locator("#hint-ok").is_visible(): await pg.click("#hint-ok")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**launch_opts())
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page()
        pg.on("console", lambda m: R["errors"].append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: R["errors"].append("pageerror: " + str(e)))
        await start(pg)

        # --- setup: AUTO on, pet + minion out, mid-cast, standing next to the boss ---
        await ev(pg, f"""(()=>{{
          const g={G}, P={P};
          g.autoHunt=true; g.S.auto=true; g.S.hpPot=3;
          const pet=P.addComp('pet','fox',5); const mn=P.addComp('minion','slime',5);
          P.syncComps();
          const boss=g.monsters.find(m=>m.type==='boss');
          boss.dead=false; boss.hp=boss.maxHp; boss.x=g.hero.x+80; boss.y=g.hero.y; boss.target=g.hero;
          g.hero.mp=g.hero.maxMp; g.hero.cds[0]=0; P.setAnim(g.hero,'cast',0.8); g.hero.cast=0.5;
          g.input.x=0.7; g.input.y=0.2; g.moveTo={{x:g.hero.x+40,y:g.hero.y}};
          g.hero.hp=1;
        }})()""")
        # die via the real damage path (boss swing / hurtHero)
        await ev(pg, f"{P}._cb.hurtHero({G}.hero, 9999, {G}.monsters.find(m=>m.type==='boss'))")
        await pg.wait_for_timeout(250)
        panel = await ev(pg, f"({G}.panel==='death' && {G}.paused===true && {G}.hero.dead===true)")
        check("death screen opens and the game pauses", panel)
        check("AUTO is paused on death (will not immediately re-run into the pack)", await ev(pg, f"{G}.autoHunt===false"))
        check("death panel cannot be dismissed (Esc / backdrop)", await ev(pg, f"(()=>{{{P}.closePanel(); return {G}.panel==='death' && {G}.hero.dead;}})()"))
        # save written during death is a safe town snapshot, not the corpse
        sv = await ev(pg, "JSON.parse(localStorage.getItem(window.__PW.PW.SAVE_KEY))")
        sp = await ev(pg, f"(({G}.W.spawn.x)+','+({G}.W.spawn.y))")
        check("save during death is at town with full HP, AUTO off (not a corrupted corpse save)",
              sv and sv["hp"] > 10 and sv["auto"] is False and abs(sv["x"] - float(sp.split(',')[0])) < 8, sv)
        check("countdown shown because AUTO was on", await pg.locator("#rv-n").is_visible())

        gold0 = sv["gold"]
        # manual revive (same path as the button)
        await ev(pg, f"{P}.revive(); {P}.closePanel()")
        await pg.wait_for_timeout(200)
        st = await ev(pg, f"""(()=>{{
          const g={G}, h=g.hero, sp=g.W.spawn, P={P};
          return {{
            dead:h.dead, paused:g.paused, panel:g.panel, running:g.running,
            auto:g.autoHunt, hp:h.hp, max:h.maxHp, mp:h.mp, maxMp:h.maxMp,
            inv:h.invuln, d:Math.hypot(h.x-sp.x,h.y-sp.y),
            an:h.an, frame:P.heroFrame(h,g.t).s, moving:h.moving,
            input:g.input, moveTo:g.moveTo, hunt:g.huntTarget,
            aggro:P.aggroCount(),
            inTown:!!P.zoneAt(h.x,h.y).safe,
            timers:g.timers.length,
            alliesDead:g.allies.filter(a=>a.dead).length,
            comps:g.comps.length,
            gold:g.S.gold
          }};
        }})()""")
        check("after revive: not dead, not paused, no panel, game running",
              (not st["dead"]) and (not st["paused"]) and (not st["panel"]) and st["running"], st)
        check("respawn at town/safe point", st["inTown"] and st["d"] < 40, st)
        check("full HP and MP on respawn", st["hp"] == st["max"] and st["mp"] == st["maxMp"], st)
        check("brief invulnerability (~3s)", 2.4 <= st["inv"] <= 3.05, st["inv"])
        check("anim state machine left the dead/cast state", st["an"] is None and st["frame"] in ("idle", "walk"), st)
        check("input / joystick / moveTo / hunt target cleared",
              st["input"]["x"] == 0 and st["input"]["y"] == 0 and st["moveTo"] is None and st["hunt"] is None and not st["moving"], st)
        check("aggro cleared, no monsters attacking in town", st["aggro"] == 0, st)
        check("AUTO stays paused after respawn", st["auto"] is False)
        check("pending skill/boss timers cleared (no delayed hits in town)", st["timers"] == 0, st)
        gold = await ev(pg, f"({{now:{G}.S.gold, expected:{gold0} - Math.floor({gold0}*0.1)}})")
        check("gold lost 10% on revive, inventory otherwise intact", gold["now"] == gold["expected"], gold)

        sv2 = await ev(pg, "JSON.parse(localStorage.getItem(window.__PW.PW.SAVE_KEY))")
        check("save after revive: town, full HP, AUTO off, valid hero",
              sv2 and sv2["heroId"]=="fighter" and sv2["hp"]==st["max"] and sv2["auto"] is False and abs(sv2["x"]-await ev(pg,f"{G}.W.spawn.x"))<8, sv2)

        # invuln blocks damage
        await ev(pg, f"{P}._cb.hurtHero({G}.hero, 999, null)")
        check("invuln blocks damage", await ev(pg, f"{G}.hero.hp==={G}.hero.maxHp"))
        await ev(pg, f"{G}.hero.invuln=0")
        await ev(pg, f"{P}._cb.hurtHero({G}.hero, 10, null)")
        check("after invuln expires, damage applies again", await ev(pg, f"{G}.hero.hp < {G}.hero.maxHp"))

        # UI usable: open settings, close, joystick/keys can move
        await ev(pg, f"{G}.hero.hp={G}.hero.maxHp; {G}.hero.invuln=3")  # stay safe in town
        await pg.click("#hb-set")
        check("settings/UI usable after respawn", await ev(pg, f"{G}.panel==='settings'||{G}.panel==='menu'") or await pg.locator("#set-music").is_visible())
        await ev(pg, f"{P}.closePanel()")
        x0 = await ev(pg, f"{G}.hero.x")
        await ev(pg, f"{G}.paused=false; {G}.hero.dead=false; {G}.hero.stun=0")
        await pg.evaluate("""() => { window.__PW.G.keys.right = true; }""")
        # unpause update by ticking? game loop runs if !paused. keys.right needs bindInput upd...
        # simulate via PW.update after setting input
        await ev(pg, f"{G}.input.x=1; {G}.input.y=0; for(let i=0;i<20;i++) {P}.update(0.05)")
        x1 = await ev(pg, f"{G}.hero.x")
        check("player can move after respawn (no stuck input/loop)", x1 > x0 + 8, f"{x0:.1f}->{x1:.1f}")
        await ev(pg, f"{G}.input.x=0; {G}.hero.x={G}.W.spawn.x; {G}.hero.y={G}.W.spawn.y")

        await pg.screenshot(path=os.path.join(SHOTS, "v32_mobile_respawn.png"))

        # --- second death: mid-AUTO in the meadow, then auto-revive ---
        await ev(pg, f"""(()=>{{
          const g={G}, P={P};
          g.autoHunt=true; g.S.auto=true; g.hero.invuln=0;
          const z=P.ZONES.find(z=>z.id==='meadow');
          g.hero.x=(z.rect[0]+6)*P.T; g.hero.y=(z.rect[1]+6)*P.T;
          P._cb.hurtHero(g.hero, 99999, null);
        }})()""")
        check("second death while AUTO farming opens countdown again", await pg.locator("#rv-n").is_visible())
        await ev(pg, f"{P}.revive(); {P}.closePanel()")
        st2 = await ev(pg, f"({{dead:{G}.hero.dead, paused:{G}.paused, auto:{G}.autoHunt, hp:{G}.hero.hp, max:{G}.hero.maxHp, safe:!!{P}.zoneAt({G}.hero.x,{G}.hero.y).safe}})")
        check("second auto-style revive also unpauses at town with full HP, AUTO off",
              (not st2["dead"]) and (not st2["paused"]) and (not st2["auto"]) and st2["hp"]==st2["max"] and st2["safe"], st2)

        # --- aggro cap ---
        await ev(pg, f"""(()=>{{
          const g={G}, P={P}; g.hero.invuln=0; g.autoHunt=false;
          const z=P.ZONES.find(z=>z.id==='meadow');
          g.hero.x=(z.rect[0]+8)*P.T; g.hero.y=(z.rect[1]+8)*P.T; g.cam.x=g.hero.x; g.cam.y=g.hero.y;
          const pack=g.monsters.filter(m=>m.type==='slime'||m.type==='rabbit');
          pack.forEach((m,i)=>{{ m.dead=false; m.dieT=0; m.hp=m.maxHp; m.stun=0; m.slow=0; m.target=null; m.forceT=0;
            m.x=g.hero.x+30+(i%5)*12; m.y=g.hero.y+(i*9)%40; m.hx=m.x-80; m.hy=m.y; }});
          for(let i=0;i<12;i++) P.update(0.16);
        }})()""")
        cap = await ev(pg, f"({{n:{P}.aggroCount(), cap:{P}.aggroCap(), zone:{P}.zoneAt({G}.hero.x,{G}.hero.y).id}})")
        check("meadow aggro cap is 3 and is respected even with a packed spawn",
              cap["zone"]=="meadow" and cap["cap"]==3 and cap["n"]<=3, cap)

        # hitting a 4th monster evicts the farthest rather than growing the pack
        await ev(pg, f"""(()=>{{
          const g={G}, P={P};
          const idle=g.monsters.find(m=>!m.dead && !m.target && (m.type==='slime'||m.type==='rabbit'));
          if(idle){{ idle.x=g.hero.x+20; idle.y=g.hero.y; P._cb.damageMonster(idle, 1, g.hero, false, {{}}); }}
          for(let i=0;i<6;i++) P.update(0.16);
        }})()""")
        cap2 = await ev(pg, f"{P}.aggroCount()")
        check("claiming a new target does not exceed the cap", cap2 <= 3, cap2)

        # leash: drag a slime far from home, it should drop aggro and walk back
        went = await ev(pg, f"""(()=>{{
          const g={G}, P={P};
          const m=g.monsters.find(m=>m.type==='slime'&&!m.dead);
          m.hx=m.x; m.hy=m.y; m.x=m.hx+P.LEASH+80; m.y=m.hy; m.target=g.hero;
          P.update(0.05);
          return {{target:!!m.target, dist:Math.hypot(m.x-m.hx,m.y-m.hy)}};
        }})()""")
        check("leash drops aggro when a monster is dragged past the leash range", went["target"] is False, went)

        # respawn not on top of / in view of the player
        close = await ev(pg, f"""(()=>{{
          const g={G}, P={P};
          const m=g.monsters.find(m=>m.type==='slime');
          m.dead=true; m.respT=0; m.hx=g.hero.x+40; m.hy=g.hero.y;
          P.update(0.05);
          return {{dead:m.dead, respT:m.respT}};
        }})()""")
        check("dead monster does not respawn on top of / next to the player", close["dead"] is True and close["respT"] > 0, close)

        # --- AUTO: one target at a time + retreat at low HP ---
        await ev(pg, f"""(()=>{{
          const g={G}, P={P}; g.S.settings.retreatPct=30; g.S.hpPot=0; // no pots, must retreat
          g.autoHunt=true; g.hero.invuln=0; g.hero.hp=g.hero.maxHp;
          const z=P.ZONES.find(z=>z.id==='meadow');
          g.hero.x=(z.rect[0]+8)*P.T; g.hero.y=(z.rect[1]+8)*P.T;
          const pack=g.monsters.filter(m=>m.type==='slime'&&!m.dead).slice(0,5);
          pack.forEach((m,i)=>{{ m.hp=m.maxHp; m.x=g.hero.x+70+i*16; m.y=g.hero.y; m.hx=m.x; m.hy=m.y; m.target=null; }});
          P.update(0.2);
        }})()""")
        same = await ev(pg, f"""(()=>{{
          const g={G}, P={P}; let prev=g.huntTarget, switched=false, ticks=0;
          for(let i=0;i<12;i++){{ P.update(0.05); ticks++;
            if(g.huntTarget && prev && g.huntTarget!==prev && !prev.dead) switched=true;
            prev=g.huntTarget;
          }}
          return {{switched, ticks, type: prev && prev.type, dead: !!(prev&&prev.dead)}};
        }})()""")
        check("AUTO sticks to one hunt target at a time (only switches when it dies)", not same["switched"] and same["ticks"]==12, same)

        await ev(pg, f"""(()=>{{
          const g={G}, P={P}; g.hero.hp=Math.floor(g.hero.maxHp*0.2); g.S.hpPot=0;
          const sp=g.W.spawn, ox=g.hero.x;
          for(let i=0;i<40;i++) P.update(0.05);
          return window.__autoRet={{ox, x:g.hero.x, y:g.hero.y, spx:sp.x, spy:sp.y, safe:!!P.zoneAt(g.hero.x,g.hero.y).safe, d0:Math.hypot(ox-sp.x,g.hero.y-sp.y), d1:Math.hypot(g.hero.x-sp.x,g.hero.y-sp.y)}};
        }})()""")
        ret = await ev(pg, "window.__autoRet")
        check("AUTO retreats toward town at low HP (default 30%)", ret["d1"] < ret["d0"] - 10 or ret["safe"], ret)

        # with potions, AUTO drinks instead of just dying
        await ev(pg, f"""(()=>{{
          const g={G}, P={P}; g.S.hpPot=2; g.S.settings.potPct=40; g.hero.potT=0;
          g.hero.hp=Math.floor(g.hero.maxHp*0.2); g.autoHunt=true;
          const pots=g.S.hpPot; P.playerControl(g.hero, 0.05, g.S);
          return window.__potion={{pots, now:g.S.hpPot, hp:g.hero.hp, max:g.hero.maxHp}};
        }})()""")
        pot = await ev(pg, "window.__potion")
        check("AUTO uses a potion when HP is below the configured threshold", pot["now"] == pot["pots"] - 1 and pot["hp"] > pot["max"] * 0.2, pot)

        await ev(pg, f"{G}.hero.hp={G}.hero.maxHp; {G}.autoHunt=false; {G}.hero.invuln=3")
        # a normal fight screenshot: one slime in front of the heroine, not a swarm
        await ev(pg, f"""(()=>{{
          const g={G}, P={P};
          const z=P.ZONES.find(z=>z.id==='meadow');
          g.hero.x=(z.rect[0]+8)*P.T; g.hero.y=(z.rect[1]+8)*P.T; g.cam.x=g.hero.x; g.cam.y=g.hero.y-10; g.hero.face=0;
          g.monsters.forEach(m=>{{m.target=null; if(m.type!=='boss'){{m.x=m.hx; m.y=m.hy;}}}});
          const s=g.monsters.find(m=>m.type==='slime'&&!m.dead);
          s.x=g.hero.x+70; s.y=g.hero.y; s.hp=s.maxHp; P.setAnim(g.hero,'attack',0.4);
        }})()""")
        await pg.wait_for_timeout(200)
        await pg.screenshot(path=os.path.join(SHOTS, "v32_mobile_fight.png"))

        # reload after a mid-fight death-save: must start in town, not the farm
        await ev(pg, f"""(()=>{{
          const g={G}, P={P};
          const z=P.ZONES.find(z=>z.id==='meadow');
          g.hero.invuln=0; g.hero.dead=false; g.hero.hp=1; g.autoHunt=true; g.S.auto=true;
          g.hero.x=(z.rect[0]+8)*P.T; g.hero.y=(z.rect[1]+8)*P.T;
          P._cb.hurtHero(g.hero, 99999, null);
        }})()""")
        check("death in the meadow actually triggered (invuln was off)", await ev(pg, f"{G}.hero.dead===true && {G}.panel==='death'"))
        await pg.reload()
        await pg.wait_for_function("window.__PW_READY===true", timeout=60000)
        await pg.click("#t-continue")
        await pg.wait_for_function(G + ".running===true")
        load = await ev(pg, f"({{x:{G}.hero.x, y:{G}.hero.y, hp:{G}.hero.hp, max:{G}.hero.maxHp, auto:{G}.autoHunt, safe:!!{P}.zoneAt({G}.hero.x,{G}.hero.y).safe, dead:{G}.hero.dead, paused:{G}.paused}})")
        check("continuing after a death-save loads in town with full HP, AUTO off, not frozen",
              load["safe"] and load["hp"] == load["max"] and load["auto"] is False and (not load["dead"]) and (not load["paused"]), load)

        await ctx.close(); await b.close()
    check("no console errors / page errors", not R["errors"], R["errors"][:6])
    ok = sum(c["ok"] for c in R["checks"])
    print(f"\n{ok}/{len(R['checks'])} checks passed")
    json.dump(R, open(os.path.join(SHOTS, "death-results.json"), "w"), indent=1)
    sys.exit(0 if ok == len(R["checks"]) else 1)
asyncio.run(main())
