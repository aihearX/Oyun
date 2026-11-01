// Takım ekranının iki düzeyli sekmeleri (YN-083): üst sırada Sohbet, Etkinlikler ve Takım / Rekabet grupları; Üyeler, Yardım,
// Savaş, Takım Yarışı… grubunun alt sırasında. Sekme görünmüyorsa önce grupları sırayla açar, sonra sekmeye dokunur.
export async function takimSekme(page, label) {
  const t = page.locator('.subtabs .subtab', { hasText: label }).first();
  if (!(await t.count())) {
    for (const g of ['takim', 'rekabet']) {
      await page.locator(`[data-subtabs="takim-grup"] .subtab[data-sekme="${g}"]`).click();
      if (await t.waitFor({ timeout: 1500 }).then(() => true, () => false)) break;
    }
  }
  await t.scrollIntoViewIfNeeded().catch(() => undefined);
  await t.click();
}
