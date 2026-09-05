export const isDemoModeEnabled = (
  environment: Readonly<Record<string, string | undefined>> = process.env
): boolean => environment.FLO_DEMO_MODE === "true" || environment.NODE_ENV !== "production";
