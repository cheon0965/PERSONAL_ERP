const { PassThrough } = require('node:stream');
const Module = require('node:module');
const path = require('node:path');

function applyEnvPatch(envPatch) {
  const previousValues = new Map();

  for (const [key, value] of Object.entries(envPatch)) {
    previousValues.set(key, process.env[key]);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = String(value);
    }
  }

  return () => {
    for (const [key, value] of previousValues.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

class InProcessWorker {
  constructor(workerPath, options = {}) {
    this.workerPath = workerPath;
    this.options = options;
    this.stdout = new PassThrough();
    this.stderr = new PassThrough();
    this.moduleExports = require(workerPath);
    this.queue = Promise.resolve();

    const exposedMethods =
      options.exposedMethods && options.exposedMethods.length > 0
        ? options.exposedMethods
        : Object.keys(this.moduleExports).filter(
            (key) => typeof this.moduleExports[key] === 'function'
          );

    for (const methodName of exposedMethods) {
      if (methodName.startsWith('_')) {
        continue;
      }

      this[methodName] = (...args) => {
        const runTask = async () => this.invoke(methodName, args);
        const task = this.queue.then(runTask, runTask);

        this.queue = task.catch(() => undefined);

        return task;
      };
    }
  }

  async invoke(methodName, args) {
    const target =
      methodName === 'default'
        ? this.moduleExports.default || this.moduleExports
        : this.moduleExports[methodName];

    if (typeof target !== 'function') {
      throw new Error(
        `In-process Next worker method "${methodName}" was not found in ${this.workerPath}.`
      );
    }

    const restoreEnv = applyEnvPatch({
      IS_NEXT_WORKER: 'true',
      ...(this.options.forkOptions?.env || {})
    });

    this.options.onActivity?.();

    try {
      return await target(...args);
    } finally {
      restoreEnv();
      this.options.onActivityAbort?.();
    }
  }

  getStdout() {
    return this.stdout;
  }

  getStderr() {
    return this.stderr;
  }

  async end() {
    await this.queue.catch(() => undefined);
    return { forceExited: false };
  }

  close() {}
}

function applyNextInProcessWorkerPatch() {
  if (Module._load.__nextInProcessWorkerPatched) {
    return;
  }

  const originalLoad = Module._load;
  const workerModulePathSuffix = path.normalize(
    path.join('next', 'dist', 'lib', 'worker.js')
  );

  Module._load = function patchedLoad(request, parent, isMain) {
    const resolved = Module._resolveFilename(request, parent, isMain);
    const loaded = originalLoad.apply(this, arguments);

    if (
      typeof resolved === 'string' &&
      path.normalize(resolved).endsWith(workerModulePathSuffix)
    ) {
      return {
        ...loaded,
        Worker: InProcessWorker
      };
    }

    return loaded;
  };

  Module._load.__nextInProcessWorkerPatched = true;
  Module._load.__nextInProcessWorkerOriginal = originalLoad;
}

module.exports = {
  applyNextInProcessWorkerPatch
};
