/**
 * TANESCO Pole Tilt Monitor — ESP8266/ESP32
 * 
 * Reads tilt angle from MPU-6050 IMU, builds a GET request URL,
 * and sends it to the Render backend every SEND_INTERVAL_MS ms.
 * 
 * URL format:
 *   https://<your-app>.onrender.com/api/reading?node=A&tilt=12.50
 * 
 * Wiring (MPU-6050 → ESP8266):
 *   VCC → 3.3V
 *   GND → GND
 *   SCL → D1 (GPIO5)
 *   SDA → D2 (GPIO4)
 */

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266WiFiMulti.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>
#include <Wire.h>

// ── CONFIG — change these ─────────────────────────────────────────
const char* WIFI_SSID     = "INCUBATION";
const char* WIFI_PASSWORD = "cheichei@2025";

// Your Render app URL (no trailing slash)
const char* SERVER_HOST   = "https://tanesco-pole-monitor.onrender.com";

// Unique ID for this pole node (A, B, C …)
const char* NODE_ID       = "A";

// How often to send a reading (milliseconds)
const unsigned long SEND_INTERVAL_MS = 10000;   // 10 seconds

// Tilt threshold for local LED warning (degrees)
const float TILT_WARNING_DEG = 10.0;

// ── MPU-6050 register addresses ───────────────────────────────────
#define MPU_ADDR       0x68
#define PWR_MGMT_1     0x6B
#define ACCEL_XOUT_H   0x3B

// ── Globals ───────────────────────────────────────────────────────
ESP8266WiFiMulti WiFiMulti;
unsigned long    lastSendTime = 0;

// ── MPU-6050 helpers ──────────────────────────────────────────────
void mpuInit() {
  Wire.begin();
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(PWR_MGMT_1);
  Wire.write(0x00);   // wake up
  Wire.endTransmission(true);
  Serial.println("[MPU] Initialised");
}

// Returns tilt angle in degrees using accelerometer X and Z axes
float readTiltAngle() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(ACCEL_XOUT_H);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 6, true);   // AX, AY, AZ (2 bytes each)

  int16_t ax = Wire.read() << 8 | Wire.read();
  int16_t ay = Wire.read() << 8 | Wire.read();
  int16_t az = Wire.read() << 8 | Wire.read();

  // Convert raw to g (±2g scale → divide by 16384)
  float ax_g = ax / 16384.0;
  float az_g = az / 16384.0;

  // Tilt angle from vertical (0° = upright)
  float angle = atan2(ax_g, az_g) * 180.0 / PI;
  return angle;
}

// ── WiFi ──────────────────────────────────────────────────────────
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFiMulti.addAP(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[WIFI] Connecting");
  while (WiFiMulti.run() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }
  Serial.println("\n[WIFI] Connected — IP: " + WiFi.localIP().toString());
}

// ── Send reading to backend ───────────────────────────────────────
void sendReading(float tilt) {
  if (WiFiMulti.run() != WL_CONNECTED) {
    Serial.println("[WIFI] Not connected, skipping send");
    return;
  }

  // Build URL:  /api/reading?node=A&tilt=12.50
  char url[128];
  snprintf(url, sizeof(url), "%s/api/reading?node=%s&tilt=%.2f",
           SERVER_HOST, NODE_ID, tilt);

  Serial.print("[HTTP] Sending → ");
  Serial.println(url);

  std::unique_ptr<BearSSL::WiFiClientSecure> client(new BearSSL::WiFiClientSecure);
  // Accept any certificate (simplest for Render's Let's Encrypt cert).
  // For production, pin the cert fingerprint instead.
  client->setInsecure();

  HTTPClient https;
  if (https.begin(*client, url)) {
    int code = https.GET();
    if (code == HTTP_CODE_OK) {
      String body = https.getString();
      Serial.println("[HTTP] Response: " + body);
    } else {
      Serial.printf("[HTTP] Error %d: %s\n", code,
                    https.errorToString(code).c_str());
    }
    https.end();
  } else {
    Serial.println("[HTTP] Unable to connect to server");
  }
}

// ── Setup ─────────────────────────────────────────────────────────
void setup() {
  Serial.begin(9600);
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH);   // off (active LOW)

  Serial.println("\n\n=== TANESCO Pole Monitor ===");
  Serial.println("Node ID: " + String(NODE_ID));

  mpuInit();
  connectWiFi();

  Serial.println("[SETUP] Ready — sending every " +
                 String(SEND_INTERVAL_MS / 1000) + " s");
}

// ── Loop ──────────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();
  if (now - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = now;

    float tilt = readTiltAngle();
    Serial.printf("[TILT] Node %s → %.2f°\n", NODE_ID, tilt);

    // Blink LED on warning
    if (abs(tilt) >= TILT_WARNING_DEG) {
      digitalWrite(LED_BUILTIN, LOW);   // on
      delay(200);
      digitalWrite(LED_BUILTIN, HIGH);  // off
    }

    sendReading(tilt);
  }
}
