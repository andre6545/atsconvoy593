export default async function handler(req, res) {
  const target = "http://159.89.51.54/status";
  try {
    const response = await fetch(target, {
      method: "GET",
      headers: { "Accept": "application/json", "Cache-Control": "no-cache" },
      cache: "no-store",
    });

    const text = await response.text();
    if (!response.ok) {
      return res.status(502).json({
        error: `El servidor ATS respondió HTTP ${response.status}`,
        upstream: target,
        body: text.slice(0, 500)
      });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        error: "El endpoint respondió, pero no devolvió JSON válido.",
        upstream: target,
        body: text.slice(0, 500)
      });
    }

    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({
      error: "No se pudo conectar con 159.89.51.54/status desde el servidor proxy.",
      detail: error?.message || String(error),
      upstream: target
    });
  }
}
