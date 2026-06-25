const { requestJson } = require("./http");
const { normalizeWeatherWidget } = require("./normalize");

function createWeatherService({ readData }) {
  return {
    readWeather: () => readWeather(readData)
  };
}

async function readWeather(readData) {
  const data = readData();
  const weather = normalizeWeatherWidget(data.widgets?.weather);
  if (!weather.enabled) return { enabled: false };
  if (!weather.latitude || !weather.longitude) {
    return { enabled: true, ok: false, label: weather.label, message: "Koordinaten fehlen" };
  }

  const params = new URLSearchParams({
    latitude: weather.latitude,
    longitude: weather.longitude,
    current: "temperature_2m,relative_humidity_2m,weather_code,precipitation",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "1"
  });
  const payload = await requestJson(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  const current = payload.current || {};
  const daily = payload.daily || {};
  const temperature = roundNumber(current.temperature_2m);
  const code = Number(current.weather_code);

  return {
    enabled: true,
    ok: true,
    label: weather.label,
    updatedAt: current.time || new Date().toISOString(),
    temperature,
    condition: weatherCodeText(code),
    weatherCode: Number.isFinite(code) ? code : null,
    precipitation: roundNumber(current.precipitation),
    humidity: roundNumber(current.relative_humidity_2m),
    rainChance: roundNumber(firstArrayValue(daily.precipitation_probability_max)),
    high: roundNumber(firstArrayValue(daily.temperature_2m_max)),
    low: roundNumber(firstArrayValue(daily.temperature_2m_min))
  };
}

function firstArrayValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function roundNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function weatherCodeText(code) {
  if ([0].includes(code)) return "Klar";
  if ([1, 2].includes(code)) return "Teilweise wolkig";
  if ([3].includes(code)) return "Bewölkt";
  if ([45, 48].includes(code)) return "Nebel";
  if ([51, 53, 55, 56, 57].includes(code)) return "Nieselregen";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Regen";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Schnee";
  if ([95, 96, 99].includes(code)) return "Gewitter";
  return "Wetter";
}

module.exports = {
  createWeatherService
};
