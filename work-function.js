const ts = require('typescript');

function setupWorkFunction(workObj)
{
  const workFunction = workObj.function;
  const language     = workObj.language;

  if (['js', 'javascript', ''].includes(language))
    return { workFunction };

  else if (['py', 'python'].includes(language))
    throw new Error(`DCP-API does not support ${language} yet.`);

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

exports.setup = setupWorkFunction;

