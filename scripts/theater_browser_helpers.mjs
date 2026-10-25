// Renderer regressions explicitly open the optional inspector they exercise.
export async function openTheaterInspector(page){
 if(await page.locator('html.desktop-mode').count())return;
 const toggle=page.locator('#toggleRightPanel');
 if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
}
