#!/bin/zsh

APP_DIR="/Users/thuyanh/Desktop/Desktop Organized/Projects/Chinese"
PORT="5174"
LOCAL_URL="http://127.0.0.1:${PORT}/"
LOG_FILE="${APP_DIR}/.vite-server.log"
PID_FILE="${APP_DIR}/.vite-server.pid"
TUNNEL_LOG_FILE="${APP_DIR}/.cloudflared.log"
TUNNEL_PID_FILE="${APP_DIR}/.cloudflared.pid"

cd "${APP_DIR}" || exit 1

LOCAL_HOST_NAME="$(scutil --get LocalHostName 2>/dev/null)"
DEFAULT_INTERFACE="$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}')"
WIFI_IP=""
if [ -n "${DEFAULT_INTERFACE}" ]; then
  WIFI_IP="$(ipconfig getifaddr "${DEFAULT_INTERFACE}" 2>/dev/null)"
fi
if [ -z "${WIFI_IP}" ]; then
  WIFI_IP="$(ipconfig getifaddr en1 2>/dev/null)"
fi

PHONE_URL=""
if [ -n "${WIFI_IP}" ]; then
  PHONE_URL="http://${WIFI_IP}:${PORT}/"
elif [ -n "${LOCAL_HOST_NAME}" ]; then
  PHONE_URL="http://${LOCAL_HOST_NAME}.local:${PORT}/"
fi

if ! command -v npm >/dev/null 2>&1; then
  osascript -e 'display alert "Cannot run app" message "npm was not found on this Mac."'
  exit 1
fi

if [ ! -d "${APP_DIR}/node_modules" ]; then
  osascript -e 'display notification "Installing dependencies..." with title "Chinese pronunciation app"'
  npm install > "${LOG_FILE}" 2>&1
  if [ $? -ne 0 ]; then
    osascript -e "display alert \"Cannot install dependencies\" message \"See ${LOG_FILE}\""
    exit 1
  fi
fi

if lsof -nP -iTCP:${PORT} -sTCP:LISTEN >/dev/null 2>&1; then
  open "${LOCAL_URL}"
else
  nohup npm run dev:phone -- --port "${PORT}" --strictPort > "${LOG_FILE}" 2>&1 &
  echo $! > "${PID_FILE}"

  for _ in {1..20}; do
    if curl -fsS "${LOCAL_URL}" >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done

  if ! curl -fsS "${LOCAL_URL}" >/dev/null 2>&1; then
    osascript -e "display alert \"Cannot start app\" message \"Port ${PORT} did not respond. See ${LOG_FILE}\""
    exit 1
  fi

  open "${LOCAL_URL}"
fi

CLOUDFLARED_BIN="$(command -v cloudflared)"
if [ -z "${CLOUDFLARED_BIN}" ] && [ -x "/opt/homebrew/bin/cloudflared" ]; then
  CLOUDFLARED_BIN="/opt/homebrew/bin/cloudflared"
fi

if [ -z "${CLOUDFLARED_BIN}" ]; then
  if [ -n "${PHONE_URL}" ]; then
    printf "%s" "${PHONE_URL}" | pbcopy
    osascript -e "display dialog \"Mac: ${LOCAL_URL}\n\niPhone cung Wi-Fi: ${PHONE_URL}\n\nLink iPhone da duoc copy vao clipboard.\" buttons {\"OK\"} default button \"OK\""
  else
    osascript -e "display dialog \"Mac: ${LOCAL_URL}\n\nKhong lay duoc IP Wi-Fi de tao link iPhone.\" buttons {\"OK\"} default button \"OK\""
  fi
  exit 0
fi

TUNNEL_URL=""
TUNNEL_PROCESS_PID=""
if [ -f "${TUNNEL_PID_FILE}" ]; then
  TUNNEL_PID="$(cat "${TUNNEL_PID_FILE}")"
  if [ -n "${TUNNEL_PID}" ] && kill -0 "${TUNNEL_PID}" >/dev/null 2>&1; then
    TUNNEL_URL="$(grep -Eo 'https://[-a-zA-Z0-9]+\.trycloudflare\.com' "${TUNNEL_LOG_FILE}" 2>/dev/null | tail -1)"
  fi
fi

if [ -z "${TUNNEL_URL}" ]; then
  : > "${TUNNEL_LOG_FILE}"
  "${CLOUDFLARED_BIN}" tunnel --url "http://127.0.0.1:${PORT}" --no-autoupdate > "${TUNNEL_LOG_FILE}" 2>&1 &
  TUNNEL_PROCESS_PID=$!
  echo "${TUNNEL_PROCESS_PID}" > "${TUNNEL_PID_FILE}"

  for _ in {1..25}; do
    TUNNEL_URL="$(grep -Eo 'https://[-a-zA-Z0-9]+\.trycloudflare\.com' "${TUNNEL_LOG_FILE}" 2>/dev/null | tail -1)"
    if [ -n "${TUNNEL_URL}" ]; then
      break
    fi
    sleep 0.5
  done
fi

if [ -n "${TUNNEL_URL}" ]; then
  IPHONE_URL="${TUNNEL_URL}/"
  printf "%s" "${IPHONE_URL}" | pbcopy
  osascript -e "display dialog \"Mac: ${LOCAL_URL}\n\niPhone: ${IPHONE_URL}\n\nLink iPhone da duoc copy vao clipboard.\" buttons {\"OK\"} default button \"OK\""
elif [ -n "${PHONE_URL}" ]; then
  printf "%s" "${PHONE_URL}" | pbcopy
  osascript -e "display dialog \"Mac: ${LOCAL_URL}\n\niPhone cung Wi-Fi: ${PHONE_URL}\n\nCloudflare tunnel chua tao duoc link, nen link Wi-Fi da duoc copy.\" buttons {\"OK\"} default button \"OK\""
else
  osascript -e "display dialog \"Mac: ${LOCAL_URL}\n\nCloudflare tunnel chua tao duoc link va khong lay duoc IP Wi-Fi. Xem ${TUNNEL_LOG_FILE}.\" buttons {\"OK\"} default button \"OK\""
fi

if [ -n "${TUNNEL_PROCESS_PID}" ]; then
  echo ""
  echo "Tunnel is running. Keep this Terminal window open while using the iPhone link."
  echo "iPhone: ${IPHONE_URL:-${PHONE_URL}}"
  echo ""
  wait "${TUNNEL_PROCESS_PID}"
fi
