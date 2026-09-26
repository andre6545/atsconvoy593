export default async function handler(req, res) {
    const TRUCKY_API_URL = 'https://e.truckyapp.com/api/v1/vtc/49477/telemetry';
    const TRUCKY_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJjb21wYW55X2lkIjo0OTQ3N30.kduk-J7AxFB-DJz0HraAe2QXlPKRtQlQVbMzC1o-kZU';

    try {
        const response = await fetch(TRUCKY_API_URL, {
            headers: {
                'x-access-token': TRUCKY_TOKEN,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Error al conectar con la API de Trucky' });
        }

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
