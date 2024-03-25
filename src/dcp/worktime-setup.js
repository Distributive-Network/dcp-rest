/**
 * Initialize arguments, workfunction, and packages if needed for any
 * worktime special casing / helper stuff.
 *
 * I'm leaving this empty for now so the onus is on the user to set
 * the right parameters for their specific worktime... That's probably
 * the best appraoch to take anyways...
 */
function setupWorkForWorktime(options)
{
  const workSpec = {
    args:     options.args,
    function: options.work.function,
    worktime: options.work.runtime,
    packages: [],
  };

  // explicitly use 'map-basic' by default...
  if (!workSpec.worktime || !workSpec.worktime.name)
    workSpec.worktime = { name: 'map-basic' };

  return workSpec;
}

exports.setup = setupWorkForWorktime;

