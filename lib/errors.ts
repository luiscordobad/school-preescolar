export function toMessage(error: unknown): string {
  if (!error) {
    return "Error desconocido";
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object") {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
      return maybeMessage;
    }

    try {
      return JSON.stringify(error);
    } catch (serializationError) {
      return `Error inesperado: ${serializationError}`;
    }
  }

  return String(error);
}
