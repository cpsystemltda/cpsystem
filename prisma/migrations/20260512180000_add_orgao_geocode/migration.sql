-- Cache de geocodificação dos órgãos. Geocode externo (Nominatim) é lento
-- e tem rate limit, então cacheamos por CNPJ. Re-geocodifica quando o
-- endereço muda (comparado contra OrgaoGeocode.endereco).

CREATE TABLE "OrgaoGeocode" (
  "cnpj"         TEXT PRIMARY KEY,
  "endereco"     TEXT NOT NULL,
  "latitude"     DOUBLE PRECISION NOT NULL,
  "longitude"    DOUBLE PRECISION NOT NULL,
  "precisao"     TEXT,
  "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL
);
