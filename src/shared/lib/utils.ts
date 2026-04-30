export function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export function formatUnknown(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === "") {
    return "未知";
  }

  return String(value);
}

export function toPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function mergeBy<T, K extends keyof T>(current: T[], incoming: T[], key: K) {
  const map = new Map(current.map((item) => [item[key], item]));
  incoming.forEach((item) => map.set(item[key], item));
  return Array.from(map.values());
}

export async function readJsonResponse(response: Response) {
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as { error?: unknown }) : {};
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : `请求失败：${response.status}`);
  }
  return payload;
}
