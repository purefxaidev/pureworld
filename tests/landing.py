"""Landing page checks + screenshots. Usage: python3 tests/landing.py [BASE_URL]"""
import asyncio, sys, os, re
from playwright.async_api import async_playwright
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from _browser import launch_opts
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8080").rstrip("/")
SH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "screens"); os.makedirs(SH, exist_ok=True)
ADDR = "0x920deab53daf94ca2030ad5ceec2265bf5686941"; ok_all = True
def check(n, ok, i=""):
    global ok_all; ok_all &= bool(ok); print(("PASS " if ok else "FAIL ") + n + (" :: " + str(i) if i else ""))
async def run(b, mobile, tag):
    ctx = await (b.new_context(viewport={"width":390,"height":844}, device_scale_factor=2, is_mobile=True, has_touch=True) if mobile else b.new_context(viewport={"width":1280,"height":800}))
    pg = await ctx.new_page(); errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None); pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.add_init_script("window.__plays=[];const _p=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__plays.push(this.src.split('/').pop());return _p.apply(this,arguments)}")
    resp = await pg.goto(BASE + "/"); check(f"[{tag}] landing loads 200", resp.status == 200, resp.status)
    await pg.wait_for_selector(".char"); await pg.wait_for_load_state("networkidle")
    check(f"[{tag}] 6 characters", await pg.locator(".char").count() == 6)
    check(f"[{tag}] 18 voice buttons", await pg.locator(".vbtn").count() == 18)
    check(f"[{tag}] Play now links to /play/", (await pg.get_attribute("#play-hero", "href")) == "play/")
    check(f"[{tag}] USDT address shown", ADDR in await pg.inner_text("#addr"))
    check(f"[{tag}] footer credit PureFxAi", "PureFxAi" in await pg.inner_text("footer"))
    broken = await pg.evaluate("[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.src)"); check(f"[{tag}] no broken images", not broken, broken)
    await pg.screenshot(path=os.path.join(SH, f"v2_{tag}_landing_top.png"))
    await pg.locator(".vbtn").nth(3).scroll_into_view_if_needed(); await pg.locator(".vbtn").nth(3).click(); await pg.wait_for_timeout(300)
    pl = await pg.evaluate("window.__plays"); check(f"[{tag}] voice button plays mp3", any("fighter_1" in p for p in pl) or len(pl) > 0, pl)
    await pg.locator("#characters").scroll_into_view_if_needed(); await pg.wait_for_timeout(500)
    await pg.screenshot(path=os.path.join(SH, f"v2_{tag}_landing_characters.png"))
    await pg.locator("#support").scroll_into_view_if_needed(); await pg.wait_for_timeout(400)
    await pg.screenshot(path=os.path.join(SH, f"v2_{tag}_landing_support.png"))
    await pg.screenshot(path=os.path.join(SH, f"v2_{tag}_landing_full.png"), full_page=True)
    # play link works
    await pg.goto(BASE + "/"); await pg.click("#play-hero"); await pg.wait_for_url(re.compile(r"/play/?$")); await pg.wait_for_selector("#t-start")
    check(f"[{tag}] Play now opens the game", True, pg.url)
    check(f"[{tag}] no console errors", not errs, errs[:3]); await ctx.close()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**launch_opts())
        await run(b, False, "desktop"); await run(b, True, "mobile"); await b.close()
    sys.exit(0 if ok_all else 1)
asyncio.run(main())
