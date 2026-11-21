import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = await b.new_context(viewport={"width":390,"height":844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = await ctx.new_page(); errs=[]
        pg.on("console", lambda m: errs.append(m.type+": "+m.text) if m.type in ("error","warning") else None)
        pg.on("pageerror", lambda e: errs.append("pageerror: "+str(e)))
        await pg.goto("http://127.0.0.1:8080/play/?debug=1"); await pg.wait_for_function("window.__PW_READY===true")
        await pg.screenshot(path="/tmp/moba-work/s_title.png")
        await pg.click("#t-start")
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path="/tmp/moba-work/s_game.png")
        print("ERRS", errs)
        await b.close()
asyncio.run(main())
