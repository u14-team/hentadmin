import { Hentadmin } from './hentadmin';

async function run() {
  const hentadmin = new Hentadmin();
  await hentadmin.init();
  hentadmin.start();
}

run();