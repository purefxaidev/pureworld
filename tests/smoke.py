"""Quick smoke test: loads the game, starts, reports console errors. Usage: python3 tests/smoke.py [BASE_URL]"""
import asyncio, os, sys
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _browser import launch_opts, base_url
BASE = base_url(sys.argv); OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "screens"); os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**launch_opts())
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page(); errs = []
        pg.on("console", lambda m: errs.append(m.type + ": " + m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
        await pg.goto(BASE + "/play/?debug=1"); await pg.wait_for_function("window.__PW_READY===true", timeout=60000)
        await pg.click("#t-start"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=os.path.join(OUT, "smoke_game.png"))
        print("ERRORS:", errs or "none"); await b.close(); sys.exit(1 if errs else 0)
asyncio.run(main())
