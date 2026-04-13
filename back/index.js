const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 4000;
const BUILDING_LAT = 36.713835665825286;
const BUILDING_LON = 10.17059940845048;
app.use(cors());
app.use(express.json());
app.get('/api/weather', async (_req, res) => {
  try {
    const query = new URLSearchParams({
      latitude: BUILDING_LAT.toString(),
      longitude: BUILDING_LON.toString(),
      current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
      timezone: 'auto',
    });
    const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?${query.toString()}`);
    if (!weatherResponse.ok) {
      throw new Error(`Open-Meteo error: ${weatherResponse.status}`);
    }
    const weatherData = await weatherResponse.json();
    const current = weatherData.current;
    if (!current) {
      throw new Error('Missing current weather data');
    }
    res.json({
        temperature: current.temperature_2m,
        humidity: current.relative_humidity_2m,
        weatherCode: current.weather_code,
        windSpeed: current.wind_speed_10m,
        observedAt: current.time,
        latitude: BUILDING_LAT,
        longitude: BUILDING_LON,
        locationLabel: 'Batiment principal',
      });
    } catch (error) {
      res.status(500).json({
        message: 'Failed to fetch weather data',
        error: error.message,
      });
    }
  });
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.listen(PORT, () => {
    console.log(`Weather backend listening on http://localhost:${PORT}`);
  });
