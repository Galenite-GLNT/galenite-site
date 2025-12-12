export function getQueryParam(name) {
  const url = new URL(location.href);
  return url.searchParams.get(name);
}
