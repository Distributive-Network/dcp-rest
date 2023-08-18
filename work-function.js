const ts = require('typescript');

function setupWorkFunction(workObj)
{
  const workFunction = workObj.function;
  const language     = workObj.language;

  if (['js', 'javascript', ''].includes(language))
    return { workFunction };

  else if (['py', 'python'].includes(language))
    return setupPython(workFunction);

  else if (['ts', 'typescript'].includes(language))
    return { workFunction: compileTypeScript(workFunction) };

  throw new Error(`DCP-API does not support ${language} yet.`);
}

function compileTypeScript(workFunction)
{
  // Set compiler options
  const compilerOptions = {
    noEmitOnError: true,
    noImplicitAny: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.CommonJS,
  };

  // Compile the input
  const result = ts.transpileModule(workFunction, {
    compilerOptions,
  });

  // remove trailing semicolon
  const cleanedCode = result.outputText.replace(/;\s*$/, '');

  return cleanedCode;  
}

function setupPython(workFunction)
{
  function extractFirstFunctionName(input)
  {
      const match = /def (\w+)\(/.exec(input);
      return match ? match[1] : null;
  }

  const pyFunctionName = extractFirstFunctionName(workFunction);

  const jsWrapper = `
    async function workFunction (datum) {
      progress();
      const pyodideCore = require('pyodide-core.js');
      progress(0.5);
      const pyodide = await pyodideCore.pyodideInit();

      const res = pyodide.runPython(\`${workFunction}
        \`);

      if (res)
        return res(datum);

      const workFunction = pyodide.globals.get("${pyFunctionName}");
      return workFunction(datum);
    }
  `;

  return { workFunction: jsWrapper, requires: [ 'pyodide-core/pyodide-core.js' ] };
}

exports.setup = setupWorkFunction;

