/**
 * Marks a framework-independent application service so TypeScript emits
 * constructor metadata that the outer dependency-injection container can use.
 */
export function ApplicationService(): ClassDecorator {
  return () => undefined;
}
