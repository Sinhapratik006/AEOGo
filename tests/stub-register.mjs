import Module from "node:module";

const origLoad = Module._load;
Module._load = function (...args) {
  if (args[0] === "server-only") return {};
  return origLoad.apply(this, args);
};
