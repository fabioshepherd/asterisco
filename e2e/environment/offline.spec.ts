import { expect, fixture, test, workspacePath } from "../support/fixtures";

/*
 * Local-first: with the network gone the app opens, edits and saves a document,
 * and the page never tries to reach another origin. The production bundle is
 * served by `vite preview`, so only that origin is allowed; every other request
 * is recorded and aborted.
 */

const TYPED = "Written with the network off.";

test("works offline and sends nothing off the device", async ({ app, baseURL }) => {
  const { page } = app;
  const origin = new URL(baseURL ?? "").origin;
  const external: string[] = [];
  await page.context().route(
    (url) => url.origin !== origin,
    async (route) => {
      external.push(route.request().url());
      await route.abort("internetdisconnected");
    },
  );

  await app.launch({ open: ["notes.md"] });
  await page.context().setOffline(true);
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);

  await page.getByText("The first line of the notes.").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type(TYPED);
  await expect(page.getByRole("tab", { name: "notes.md, unsaved changes" })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+s");

  await expect.poll(async () => (await app.mock()).writes.length).toBe(1);
  const [write] = (await app.mock()).writes;
  expect(write?.path).toBe(workspacePath("notes.md"));
  expect(write?.contents).toBe(`${fixture("notes.md").trimEnd()}\n\n${TYPED}\n`);
  expect(external, "requests to other origins").toEqual([]);
});
