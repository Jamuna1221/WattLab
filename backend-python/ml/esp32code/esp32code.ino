#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <time.h>
#include <math.h>
#include "SPIFFS.h"

// ================= WIFI =================
const char* ssid     = "MYESP";
const char* password = "123456789";

// ================= BACKEND =================
const char* serverName  = "http://192.168.137.1:5000/api/readings";
const char* deviceId    = "SIM-DEVICE-001"; // replace with your real deviceId
const char* deviceToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkZXZpY2VJZCI6IlNJTS1ERVZJQ0UtMDAxIiwidXNlcklkIjoiMzY1MTFkNDAtMzAyZi00ODc1LWFiYTktNThjM2JjYTUwYTZhIiwiaWF0IjoxNzc1ODQ3NzQxLCJleHAiOjE3Nzg0Mzk3NDF9.JePSNcB-7eeGOHlVfuV6YuN1xk-SN-I9654MrmMf7Ts"; // replace with valid JWT token

// appliance mode: streamType="appliance", applianceLabel="bulb"/"mobile_charger"/"iron_box"
// aggregate mode: streamType="aggregate", applianceLabel=""
const char* streamType     = "aggregate";
const char* applianceLabel = "";

// ================= LCD =================
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ================= SENSOR PINS =================
#define VOLT_PIN 34
#define CURR_PIN 35

// ================= RMS + CALIBRATION =================
// RMS window for 50Hz mains:
// 200 ms ~= 10 cycles (good stability)
const uint32_t RMS_WINDOW_MS = 200;

// ADC reference for ESP32 12-bit
const float ADC_REF_V = 3.3f;
const float ADC_MAX   = 4095.0f;

// Calibration values (engineering units per ADC-count-RMS)
// Start with these rough values, then tune using known load
float voltsPerCount = 0.10f;    // Vrms per ADC-count-rms
float ampsPerCount  = 0.0010f;  // Arms per ADC-count-rms

// Power factor estimate (later you can measure dynamically if needed)
float powerFactor = 0.95f;

// Deadbands (set to 0 during calibration)
float CURRENT_DEADBAND_A = 0.00f;
float POWER_DEADBAND_W   = 0.00f;

// Smoothing
const float EMA_ALPHA_V = 0.25f;
const float EMA_ALPHA_I = 0.25f;

// Debug calibration prints
#define CALIBRATION_DEBUG 1

// ================= OFFLINE QUEUE =================
const char* QUEUE_FILE = "/queue.txt";
const int MAX_QUEUE_LINES = 6500; // ~10.8h at 6s interval

// ================= RUNTIME =================
float voltage = 0.0f;
float current = 0.0f;
float power   = 0.0f;

float voltageEma = 0.0f;
float currentEma = 0.0f;

float voltageOffsetADC = 0.0f;
float currentOffsetADC = 0.0f;

int lastHttpCode = -1;
unsigned long lastWifiTryMs = 0;
const unsigned long WIFI_RETRY_MS = 5000;

// =====================================================
// ADC + Filtering Helpers
// =====================================================
float readADCAverage(int pin, int samples) {
  long sum = 0;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delay(1);
  }
  return sum / (float)samples;
}

float applyEma(float prev, float input, float alpha) {
  return (alpha * input) + ((1.0f - alpha) * prev);
}

void calibrateOffsets() {
  // Keep inputs connected but no-load as much as possible for current channel
  // (voltage channel may still have mains waveform depending on your sensor topology)
  const int rounds = 30;
  float vSum = 0.0f;
  float iSum = 0.0f;

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Calibrating...");
  Serial.println("Calibrating ADC offsets. Keep load OFF.");

  for (int r = 0; r < rounds; r++) {
    vSum += readADCAverage(VOLT_PIN, 120);
    iSum += readADCAverage(CURR_PIN, 120);
    delay(20);
  }

  voltageOffsetADC = vSum / rounds;
  currentOffsetADC = iSum / rounds;

  Serial.print("voltageOffsetADC = "); Serial.println(voltageOffsetADC, 2);
  Serial.print("currentOffsetADC = "); Serial.println(currentOffsetADC, 2);
}

// True RMS measurement over time window
void readFilteredElectricals() {
  uint32_t startMs = millis();
  double sumSqV = 0.0;
  double sumSqI = 0.0;
  uint32_t n = 0;

  while ((millis() - startMs) < RMS_WINDOW_MS) {
    int rawV = analogRead(VOLT_PIN);
    int rawI = analogRead(CURR_PIN);

    float vCounts = (float)rawV - voltageOffsetADC;
    float iCounts = (float)rawI - currentOffsetADC;

    sumSqV += (double)vCounts * (double)vCounts;
    sumSqI += (double)iCounts * (double)iCounts;
    n++;

    // ~5kHz effective sample pace
    delayMicroseconds(200);
  }

  if (n == 0) return;

  float vRmsCounts = sqrt(sumSqV / (double)n);
  float iRmsCounts = sqrt(sumSqI / (double)n);

  float rawV = vRmsCounts * voltsPerCount;
  float rawI = iRmsCounts * ampsPerCount;

  // EMA smoothing
  if (voltageEma == 0.0f) voltageEma = rawV;
  if (currentEma == 0.0f) currentEma = rawI;

  voltageEma = applyEma(voltageEma, rawV, EMA_ALPHA_V);
  currentEma = applyEma(currentEma, rawI, EMA_ALPHA_I);

  if (currentEma < CURRENT_DEADBAND_A) currentEma = 0.0f;

  voltage = voltageEma;
  current = currentEma;
  power = voltage * current * powerFactor;

  if (power < POWER_DEADBAND_W) power = 0.0f;

#if CALIBRATION_DEBUG
  Serial.print("RMS counts V="); Serial.print(vRmsCounts, 2);
  Serial.print(" I="); Serial.print(iRmsCounts, 2);
  Serial.print(" | Eng V="); Serial.print(voltage, 2);
  Serial.print(" I="); Serial.print(current, 3);
  Serial.print(" P="); Serial.println(power, 2);
#endif
}

// =====================================================
// WiFi + Time
// =====================================================
void ensureWiFiConnected() {
  if (WiFi.status() == WL_CONNECTED) return;
  if (millis() - lastWifiTryMs < WIFI_RETRY_MS) return;

  lastWifiTryMs = millis();
  WiFi.disconnect();
  WiFi.begin(ssid, password);
  Serial.println("WiFi reconnect attempt...");
}

String getIsoTimestamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "1970-01-01T00:00:00Z";
  char buffer[30];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buffer);
}

// =====================================================
// Payload + Network
// =====================================================
String buildPayload(float v, float i, float p, const String& ts) {
  String payload = "{";
  payload += "\"deviceId\":\"" + String(deviceId) + "\",";
  payload += "\"timestamp\":\"" + ts + "\",";
  payload += "\"voltage\":" + String(v, 2) + ",";
  payload += "\"current\":" + String(i, 3) + ",";
  payload += "\"activePower\":" + String(p, 2) + ",";
  payload += "\"powerFactor\":" + String(powerFactor, 2) + ",";
  payload += "\"streamType\":\"" + String(streamType) + "\"";

  if (String(streamType) == "appliance" && String(applianceLabel).length() > 0) {
    payload += ",\"applianceLabel\":\"" + String(applianceLabel) + "\"";
  }

  payload += "}";
  return payload;
}

bool postPayload(const String& payload, int& httpCode, String& responseText) {
  if (WiFi.status() != WL_CONNECTED) {
    httpCode = -1;
    responseText = "WiFi offline";
    return false;
  }

  HTTPClient http;
  http.begin(serverName);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + deviceToken);

  httpCode = http.POST(payload);
  responseText = http.getString();
  http.end();

  return (httpCode == 200 || httpCode == 201);
}

// =====================================================
// Offline Queue (SPIFFS)
// =====================================================
void queuePayload(const String& payload) {
  File f = SPIFFS.open(QUEUE_FILE, FILE_APPEND);
  if (!f) return;
  f.println(payload);
  f.close();
}

int queuedCount() {
  File f = SPIFFS.open(QUEUE_FILE, FILE_READ);
  if (!f) return 0;

  int count = 0;
  while (f.available()) {
    String line = f.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) count++;
  }
  f.close();
  return count;
}

void pruneQueueIfNeeded() {
  File f = SPIFFS.open(QUEUE_FILE, FILE_READ);
  if (!f) return;

  String* lines = new String[MAX_QUEUE_LINES + 300];
  int n = 0;
  while (f.available() && n < (MAX_QUEUE_LINES + 300)) {
    lines[n++] = f.readStringUntil('\n');
  }
  f.close();

  if (n <= MAX_QUEUE_LINES) {
    delete[] lines;
    return;
  }

  int start = n - MAX_QUEUE_LINES;
  File w = SPIFFS.open(QUEUE_FILE, FILE_WRITE);
  if (w) {
    for (int i = start; i < n; i++) {
      lines[i].trim();
      if (lines[i].length() > 2) w.println(lines[i]);
    }
    w.close();
  }
  delete[] lines;
}

void flushQueue(int maxToSendPerLoop = 20) {
  if (WiFi.status() != WL_CONNECTED) return;

  File f = SPIFFS.open(QUEUE_FILE, FILE_READ);
  if (!f) return;

  String remaining = "";
  int sent = 0;

  while (f.available()) {
    String line = f.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) continue;

    if (sent < maxToSendPerLoop) {
      int code;
      String resp;
      bool ok = postPayload(line, code, resp);
      if (ok) {
        sent++;
      } else {
        remaining += line + "\n";
        while (f.available()) {
          String rest = f.readStringUntil('\n');
          rest.trim();
          if (rest.length() > 0) remaining += rest + "\n";
        }
        break;
      }
    } else {
      remaining += line + "\n";
    }
  }
  f.close();

  File w = SPIFFS.open(QUEUE_FILE, FILE_WRITE);
  if (w) {
    w.print(remaining);
    w.close();
  }

  if (sent > 0) {
    Serial.print("Flushed queued: ");
    Serial.println(sent);
  }
}

// =====================================================
// LCD
// =====================================================
void updateLCDStatus() {
  lcd.clear();
  lcd.setCursor(0, 0);
  if (WiFi.status() == WL_CONNECTED) {
    lcd.print("WiFi: Connected");
  } else {
    lcd.print("WiFi: Offline");
  }

  lcd.setCursor(0, 1);
  if (WiFi.status() != WL_CONNECTED) {
    lcd.print("OFF Q:");
    lcd.print(queuedCount());
  } else if (lastHttpCode == 200 || lastHttpCode == 201) {
    lcd.print("DB:OK Q:");
    lcd.print(queuedCount());
  } else if (lastHttpCode > 0) {
    lcd.print("DB Err:");
    lcd.print(lastHttpCode);
  } else {
    lcd.print("DB:Queueing");
  }
}

// =====================================================
// Setup
// =====================================================
void setup() {
  Serial.begin(115200);

  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Booting...");

  analogReadResolution(12);

  // Optional ADC attenuation, depends on your analog front-end design:
  // analogSetPinAttenuation(VOLT_PIN, ADC_11db);
  // analogSetPinAttenuation(CURR_PIN, ADC_11db);

  if (!SPIFFS.begin(true)) {
    Serial.println("SPIFFS mount failed");
  } else {
    Serial.println("SPIFFS ready");
    Serial.print("Total bytes: "); Serial.println(SPIFFS.totalBytes());
    Serial.print("Used bytes : "); Serial.println(SPIFFS.usedBytes());
  }

  WiFi.begin(ssid, password);
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  Serial.print("Mode: "); Serial.println(streamType);
  Serial.print("Label: "); Serial.println(applianceLabel);

  calibrateOffsets();

  lastHttpCode = 0;
  updateLCDStatus();
}

// =====================================================
// Loop
// =====================================================
void loop() {
  ensureWiFiConnected();

  readFilteredElectricals();

  String payload = buildPayload(voltage, current, power, getIsoTimestamp());

  if (WiFi.status() != WL_CONNECTED) {
    queuePayload(payload);
    pruneQueueIfNeeded();
    lastHttpCode = -1;
    Serial.println("WiFi offline -> queued reading");
  } else {
    int code;
    String resp;
    bool sent = postPayload(payload, code, resp);
    lastHttpCode = code;

    Serial.println("------ POST /api/readings ------");
    Serial.print("V="); Serial.print(voltage, 2);
    Serial.print(" I="); Serial.print(current, 3);
    Serial.print(" P="); Serial.println(power, 2);
    Serial.print("HTTP    : "); Serial.println(code);
    Serial.print("Response: "); Serial.println(resp);

    if (!sent) {
      queuePayload(payload);
      pruneQueueIfNeeded();
      Serial.println("Live send failed -> queued");
    } else {
      Serial.println("Live send success");
    }

    flushQueue(20);
  }

  Serial.print("Queue size: ");
  Serial.println(queuedCount());
  Serial.println("--------------------------------");

  updateLCDStatus();

  delay(6000); // reporting interval
}