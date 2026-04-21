export async function fetchJson<TData>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<TData> {
  const response = await fetch(input, init);

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(data?.error?.message ?? "La operación falló");
  }

  return (await response.json()) as TData;
}
