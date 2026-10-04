/* Outside tasks award skill points through this file.
   It loads on file:// and on a normal page. Raise `total` and reload;
   the game credits only the increase. Ids in `log` are claimed once,
   so the same id sent later with postMessage is not paid again. */
window.EXTERNAL_POINTS = {
  total: 0,
  log: []
};
