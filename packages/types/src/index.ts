/**
 * @darkscore/types — public surface. Named exports only (per package
 * CONSTITUTION). Importers should depend on this entry point so the boundary
 * checker can verify cross-package usage.
 */
export const PACKAGE_NAME = "@darkscore/types";

export * from "./result.js";
export * from "./ticker.js";
export * from "./financials.js";
export * from "./score.js";
export * from "./provider.js";
export * from "./report.js";

