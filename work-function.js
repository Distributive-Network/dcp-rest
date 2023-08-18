const ts = require('typescript');

function setupWorkFunction(workObj)
{
  const workFunction = workObj.function;
  const language     = workObj.language;

  if (['js', 'javascript', ''].includes(language))
    return { workFunction };

  else if (['py', 'python'].includes(language))
    return setupPython(workObj);

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

function setupPython(workObj)
{
  const workFunction = workObj.function;
  const pyimports    = workObj.pyimports

  const packages=[
    'scipy', 'kiwisolver', 'joblib', 'clapack',
    'setuptools', 'cycler', 'pyparsing', 'threadpoolctl',
    'pyerfa', 'distutils', 'python-dateutil', 'fonttools',
    'pillow', 'pytz', 'pyyaml', 'numpy', 'packaging',
    'numpy', 'opencv-python', 'scikit-learn',
    'distutils', 'xgboost', 'astropy', 'matplotlib',
    'pandas', 'PIL', 'distutils',
  ];

  var injectableImports = "await pyodideCore.loadPackage ([";
  for (const i in pyimports) {
    if (!packages.includes(pyimports[i]))
      throw new Error(`${pyimports[i]} is not supported in dcp yet`);
    injectableImports = injectableImports + `"${pyimports[i]}",`;
  }
  injectableImports+="]);";
  if (!pyimports || pyimports.length === 0)
    injectableImports = "";

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

      ${injectableImports}

      const res = pyodide.runPython(\`${workFunction}
        \`);

      if (res)
        return res(datum);

      const workFunction = pyodide.globals.get("${pyFunctionName}");
      return workFunction(datum);
    }
  `;

  console.log(jsWrapper);

  return { workFunction: jsWrapper, requires: [ 'pyodide-core/pyodide-core.js' ] };
}

exports.setup = setupWorkFunction;

